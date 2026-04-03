import fs from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import {
  createResolver,
  type ResolveResult,
  type Resolver,
} from "./resolver.js";
import { buildGraph } from "./graph/build.js";
import { resolveExportTables } from "./exports/resolve.js";
import { findCycles } from "./graph/scc.js";
import {
  normalizeGraphConditions,
  resolveEntryConditions,
} from "./graph/conditions.js";
import {
  emitConditionalStart,
  emitConditionalEnd,
} from "./linker/conditional-markers.js";
import { emitNamespaceObject } from "./linker/namespace.js";
import {
  emitDynamicImportConstants,
  type BundleTarget,
} from "./linker/dynamic-import-constants.js";
import { concatParts } from "./concat.js";
import { runTransformModule, runTransformModuleGraph } from "./plugins/run.js";
import type { BundlerConfig, EntrySpec } from "./config.js";
import {
  readPkgSafe,
  findPkgRoot,
  contentHash,
  contentHashShort,
  readJsonIfExists,
  writeJsonAtomic,
  ensureDir,
  type Diagnostic,
} from "@bundler/shared";
import type { BundlerPlugin } from "./plugins/types.js";
import type { ModuleGraph } from "./graph/build.js";
import type {
  CellRecord,
  ModuleNode,
  Provider,
  FileRecord,
} from "@bundler/shared";

export type BuildResult = {
  bundles: Array<{ envId: string; entryId: string; fileName: string }>;
  manifest: Record<string, unknown>;
  diagnostics: Diagnostic[];
};

type DynamicImportRef = {
  hashKey: string;
  resolvedId: string;
  exports: Array<{ exported: string; symbol: string }>;
};

type BundlePlan = {
  envId: string;
  entryId: string;
  fileName: string;
  exportMode: "entry" | "dynamic";
  parts: string[];
  dynamicImports: DynamicImportRef[];
  diagnostics: Diagnostic[];
};

type WorkerTransformResponse = {
  fileRecord: FileRecord;
};

type DynamicEntryDiscovery = ResolveResult & {
  envId: string;
};

type ModuleCollection = {
  headers: FileRecord[];
  dynamicEntries: EntrySpec[];
  resolvedMap: Map<string, string>;
};

type CacheRootInfo = {
  activeRoot: string;
  configHash: string;
};

type CacheRootMetadata = {
  configHash: string;
  config: unknown;
  createdAt: string;
  lastUsedAt: string;
};

export async function buildProject(
  config: BundlerConfig,
  plugins: BundlerPlugin[],
): Promise<BuildResult> {
  const explicitEntries = collectEntries(config.entries);
  const cacheBaseDir = path.resolve(
    config.cacheDir ?? path.join("tmp", ".bundler-cache"),
  );
  const envs = Object.keys(config.envs);
  const pool = new WorkerPool({
    workerPath: resolveWorkerPath(),
    size: resolveWorkerCount(config.maxWorkers),
  });
  const cleanup = async () => {
    await pool.close();
  };
  const resolver = createResolver();

  try {
    const cacheRoot = await prepareCacheRoot(
      cacheBaseDir,
      config,
      explicitEntries,
    );
    const { headers, dynamicEntries, resolvedMap } = await collectTransformedModules(
      explicitEntries,
      envs,
      cacheRoot.activeRoot,
      plugins,
      pool,
      resolver,
    );

    const graphs = await Promise.all(
      envs.map((envId) => buildGraph({ envId, headers, resolver })),
    );
    const transformedGraphs = await runTransformModuleGraph(plugins, graphs);

    for (const graph of transformedGraphs) {
      const cycles = findCycles(graph.nodes);
      if (cycles.length > 0) {
        throw new Error(
          `E_CYCLE: Cyclic dependency graph not supported (v1). Cycle: ${cycles[0].join(" -> ")}`,
        );
      }
      normalizeGraphConditions(graph);
      resolveExportTables(Array.from(graph.nodes.values()), graph.nodes);
    }

    const bundlePlans: BundlePlan[] = [];
    for (const graph of transformedGraphs) {
      const entries = pickEntriesForEnv(explicitEntries, graph.envId);
      for (const entry of entries) {
        bundlePlans.push(
          await createBundlePlan(graph, entry.path, config, resolver, "entry"),
        );
      }

      const dynamicForEnv = dynamicEntries.filter(
        (entry) => entry.envs?.includes(graph.envId) || !entry.envs,
      );
      for (const entry of dynamicForEnv) {
        if (entries.some((explicit) => explicit.path === entry.path)) {
          continue;
        }
        bundlePlans.push(
          await createBundlePlan(
            graph,
            entry.path,
            config,
            resolver,
            "dynamic",
          ),
        );
      }
    }

    const bundleMap = new Map<string, BundleTarget>();
    for (const plan of bundlePlans) {
      const resolved = resolvedMap.get(plan.entryId) ?? plan.entryId;
      bundleMap.set(resolved, {
        fileName: plan.fileName,
        exportMode: plan.exportMode,
      });
    }

    await fs.mkdir(config.outputs.outDir, { recursive: true });
    const bundles: Array<{ envId: string; entryId: string; fileName: string }> =
      [];
    for (const plan of bundlePlans) {
      const header = emitDynamicImportConstants(plan.dynamicImports, bundleMap);
      const patchedBundle = concatParts([header, ...plan.parts]);

      const outputPath = path.join(config.outputs.outDir, plan.fileName);
      await fs.writeFile(outputPath, patchedBundle, "utf8");
      bundles.push({
        envId: plan.envId,
        entryId: plan.entryId,
        fileName: plan.fileName,
      });
    }

    return {
      bundles,
      manifest: {},
      diagnostics: dedupeDiagnostics(
        bundlePlans.flatMap((plan) => plan.diagnostics),
      ),
    };
  } finally {
    await cleanup();
  }
}

async function prepareCacheRoot(
  cacheBaseDir: string,
  config: BundlerConfig,
  entries: EntrySpec[],
): Promise<CacheRootInfo> {
  const v2Dir = path.join(cacheBaseDir, "v2");
  await ensureDir(v2Dir);

  const normalizedConfig = normalizeConfigForCache(config, entries, cacheBaseDir);
  const configHash = contentHash(JSON.stringify(normalizedConfig));
  const activeRoot = path.join(v2Dir, configHash);
  await ensureDir(activeRoot);

  const configPath = path.join(activeRoot, "config.json");
  const existing = await readJsonIfExists<CacheRootMetadata>(configPath);
  const now = new Date().toISOString();
  await writeJsonAtomic(configPath, {
    configHash,
    config: normalizedConfig,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now,
  });

  void cleanupObsoleteCacheRoots(v2Dir, activeRoot, now);

  return { activeRoot, configHash };
}

function normalizeConfigForCache(
  config: BundlerConfig,
  entries: EntrySpec[],
  cacheBaseDir: string,
): unknown {
  return {
    envs: Object.fromEntries(
      Object.entries(config.envs)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([envId, envConfig]) => [
          envId,
          {
            conditions: [...envConfig.conditions],
            target: envConfig.target,
          },
        ]),
    ),
    entries: entries.map((entry) => ({
      id: entry.id,
      path: path.resolve(entry.path),
      envs: entry.envs ? [...entry.envs] : undefined,
    })),
    outputs: {
      outDir: path.resolve(config.outputs.outDir),
      fileName: config.outputs.fileName,
    },
    cacheDir: cacheBaseDir,
    maxWorkers: config.maxWorkers,
    diagnostics: config.diagnostics,
  };
}

async function cleanupObsoleteCacheRoots(
  v2Dir: string,
  activeRoot: string,
  nowIso: string,
): Promise<void> {
  try {
    const entries = await fs.readdir(v2Dir, { withFileTypes: true });
    const cutoff = new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000;

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) {
          return;
        }

        const candidate = path.join(v2Dir, entry.name);
        if (candidate === activeRoot) {
          return;
        }

        const metadata =
          await readJsonIfExists<Partial<CacheRootMetadata>>(
            path.join(candidate, "config.json"),
          );
        const lastUsedTime = metadata?.lastUsedAt
          ? Date.parse(metadata.lastUsedAt)
          : Number.NaN;
        const staleTime = Number.isFinite(lastUsedTime)
          ? lastUsedTime
          : (await fs.stat(candidate)).mtimeMs;
        if (staleTime < cutoff) {
          await fs.rm(candidate, { recursive: true, force: true });
        }
      }),
    );
  } catch {
    // Best-effort cleanup only.
  }
}

function collectEntries(entries: EntrySpec[]): EntrySpec[] {
  return entries.map((entry) => ({ ...entry, id: entry.id || entry.path }));
}

function pickEntriesForEnv(entries: EntrySpec[], envId: string): EntrySpec[] {
  return entries.filter((entry) => !entry.envs || entry.envs.includes(envId));
}

async function createBundlePlan(
  graph: ModuleGraph,
  entryPath: string,
  config: BundlerConfig,
  resolver: Resolver,
  exportMode: "entry" | "dynamic",
): Promise<BundlePlan> {
  const entryNode = graph.nodes.get(entryPath);
  if (!entryNode) {
    throw new Error(`Entry not found in graph: ${entryPath}`);
  }

  const { conditions, diagnostics } = resolveEntryConditions(graph, entryPath);
  const selection = collectBundleSelection(graph, entryPath);
  const orderedFiles = orderSelectedFiles(graph, selection);
  const parts: string[] = [];
  const dynamicImports: DynamicImportRef[] = [];
  const namespaceDemanded = collectNamespaceDemands(selection, graph);

  for (const node of orderedFiles) {
    const selectedCells = selection.get(node.id);
    if (!selectedCells || selectedCells.size === 0) {
      continue;
    }
    const condition = conditions.get(node.id);
    if (condition) {
        parts.push(emitConditionalStart(condition));
      }

      const cellParts = await Promise.all(
        collectOrderedCells(node, selectedCells).map(readCellSource),
      );
      parts.push(...cellParts.filter((part): part is string => part.length > 0));

      if (namespaceDemanded.has(node.id) && node.exportTable) {
        parts.push(emitNamespaceObject(node));
      }

      if (condition) {
        parts.push(emitConditionalEnd());
      }

      for (const dyn of node.irHeader.dynamicImports) {
        const resolved = await resolver(
          node.id,
          dyn.request ?? dyn.source,
          graph.envId,
        );
        const targetNode = graph.nodes.get(resolved.id);
        dynamicImports.push({
          hashKey: dyn.hashKey,
          resolvedId: resolved.id,
          exports: collectDynamicImportExports(targetNode),
        });
      }
    }
  const exportFooter =
    exportMode === "entry"
      ? emitEntryExports(graph.nodes.get(entryPath))
      : emitDynamicBundleExports(orderedFiles, selection);
  if (exportFooter) {
    parts.push(exportFooter);
  }
  const bundle = concatParts(parts);
  const hash = contentHashShort(bundle);
  const fileName = config.outputs.fileName
    ? config.outputs.fileName
        .replace("[env]", graph.envId)
        .replace("[hash]", hash)
    : `bundle.${graph.envId}.${hash}.js`;

  return {
    envId: graph.envId,
    entryId: entryPath,
    fileName,
    exportMode,
    parts,
    dynamicImports,
    diagnostics,
  };
}

async function collectTransformedModules(
  entries: EntrySpec[],
  envs: string[],
  cacheDir: string,
  plugins: BundlerPlugin[],
  pool: WorkerPool,
  resolver: Resolver,
): Promise<ModuleCollection> {
  const headers = new Map<string, FileRecord>();
  const resolvedMap = new Map<string, string>();
  const scheduled = new Set<string>();
  const dynamicEntryEnvs = new Map<string, Set<string>>();
  const inFlight = new Set<Promise<void>>();

  const schedule = (modulePath: string) => {
    if (scheduled.has(modulePath)) {
      return;
    }
    scheduled.add(modulePath);
    const task = transformModule(
      modulePath,
      envs,
      cacheDir,
      plugins,
      pool,
      resolver,
      headers,
      resolvedMap,
      dynamicEntryEnvs,
      schedule,
    ).finally(() => {
      inFlight.delete(task);
    });
    inFlight.add(task);
  };

  for (const entry of entries) {
    schedule(entry.path);
  }

  while (inFlight.size > 0) {
    await Promise.race(inFlight);
  }

  return {
    headers: Array.from(headers.values()),
    dynamicEntries: Array.from(dynamicEntryEnvs.entries()).map(([entryPath, envSet]) => ({
      id: entryPath,
      path: entryPath,
      envs: Array.from(envSet),
    })),
    resolvedMap,
  };
}

async function transformModule(
  modulePath: string,
  envs: string[],
  cacheDir: string,
  plugins: BundlerPlugin[],
  pool: WorkerPool,
  resolver: Resolver,
  headers: Map<string, FileRecord>,
  resolvedMap: Map<string, string>,
  dynamicEntryEnvs: Map<string, Set<string>>,
  schedule: (modulePath: string) => void,
): Promise<void> {
  const code = await fs.readFile(modulePath, "utf8");
  const pkgRoot = findPkgRoot(modulePath) ?? path.dirname(modulePath);
  const pkg = readPkgSafe(pkgRoot);
  const syntax = {
    jsx: modulePath.endsWith(".jsx") || modulePath.endsWith(".tsx"),
    ts: modulePath.endsWith(".ts") || modulePath.endsWith(".tsx"),
  };
  const pluginResult = await runTransformModule(plugins, {
    code,
    realPath: modulePath,
    pkg,
    syntax,
    envs,
  });
  if (pluginResult && (pluginResult as { skipCore?: boolean }).skipCore) {
    throw new Error("Custom transform cannot skip core analysis in v1.");
  }

  const multiEnvCode =
    pluginResult && "codeByEnv" in pluginResult
      ? pluginResult.codeByEnv
      : undefined;
  const fallbackCode =
    pluginResult && "code" in pluginResult ? pluginResult.code : code;
  const response = (await pool.run({
    realPath: modulePath,
    code: fallbackCode,
    pkg,
    envs,
    cacheDir,
    syntax,
    codeByEnv: multiEnvCode,
  })) as WorkerTransformResponse;
  const fileRecord = response.fileRecord;
  headers.set(fileRecord.id, fileRecord);

  if (fileRecord.flags.hasTopLevelAwait) {
    throw new Error(
      `E_TLA: Top-level 'await' is not supported (v1). at ${modulePath}`,
    );
  }

  const { dependencies, dynamicEntries } = await discoverModulesFromHeader(
    fileRecord,
    envs,
    resolver,
  );

  for (const resolved of dependencies) {
    resolvedMap.set(resolved.id, resolved.resolvedPath);
    schedule(resolved.resolvedPath);
  }

  for (const dynamicEntry of dynamicEntries) {
    resolvedMap.set(dynamicEntry.id, dynamicEntry.resolvedPath);
    const envSet = dynamicEntryEnvs.get(dynamicEntry.resolvedPath) ?? new Set<string>();
    envSet.add(dynamicEntry.envId);
    dynamicEntryEnvs.set(dynamicEntry.resolvedPath, envSet);
    schedule(dynamicEntry.resolvedPath);
  }
}

async function discoverModulesFromHeader(
  irHeader: FileRecord,
  envs: string[],
  resolver: Resolver,
): Promise<{
  dependencies: ResolveResult[];
  dynamicEntries: DynamicEntryDiscovery[];
}> {
  const dependencyPromises: Array<Promise<ResolveResult>> = [];
  const dynamicPromises: Array<Promise<DynamicEntryDiscovery>> = [];

  for (const importEntry of irHeader.imports) {
    if (importEntry.kind === "type") {
      continue;
    }
    for (const envId of envs) {
      dependencyPromises.push(
        resolver(
          irHeader.id,
          importEntry.request ?? importEntry.source,
          envId,
        ),
      );
    }
  }

  for (const conditionalImport of irHeader.conditionalImports) {
    if (!conditionalImport.elseSource) {
      continue;
    }
    for (const envId of envs) {
      dependencyPromises.push(
        resolver(
          irHeader.id,
          conditionalImport.elseRequest ?? conditionalImport.elseSource,
          envId,
        ),
      );
    }
  }

  for (const reexport of [...irHeader.exportStars, ...irHeader.reexportsNamed]) {
    for (const envId of envs) {
      dependencyPromises.push(
        resolver(irHeader.id, reexport.request ?? reexport.source, envId),
      );
    }
  }

  for (const dynamicImport of irHeader.dynamicImports) {
    for (const envId of envs) {
      dynamicPromises.push(
        resolver(
          irHeader.id,
          dynamicImport.request ?? dynamicImport.source,
          envId,
        ).then((resolved) => ({
          ...resolved,
          envId,
        })),
      );
    }
  }

  const [dependencies, dynamicEntries] = await Promise.all([
    Promise.all(dependencyPromises),
    Promise.all(dynamicPromises),
  ]);

  return {
    dependencies: dedupeResolved(dependencies),
    dynamicEntries: dedupeDynamicEntries(dynamicEntries),
  };
}

function collectBundleSelection(
  graph: ModuleGraph,
  entryId: string,
): Map<string, Set<string>> {
  const entryNode = graph.nodes.get(entryId);
  if (!entryNode) {
    throw new Error(`Entry not found in graph: ${entryId}`);
  }

  const selection = new Map<string, Set<string>>();
  const activatedFiles = new Set<string>();
  const queuedCells = new Set<string>();
  const workQueue: Array<{ nodeId: string; cellId: string }> = [];

  const enqueueCell = (node: ModuleNode, cellId: string) => {
    activateFile(node);
    const selected = selection.get(node.id) ?? new Set<string>();
    if (selected.has(cellId)) {
      if (!selection.has(node.id)) {
        selection.set(node.id, selected);
      }
      return;
    }
    selected.add(cellId);
    selection.set(node.id, selected);
    const key = `${node.id}:${cellId}`;
    if (!queuedCells.has(key)) {
      queuedCells.add(key);
      workQueue.push({ nodeId: node.id, cellId });
    }
  };

  const enqueueProvider = (provider: Provider) => {
    const providerNode = graph.nodes.get(provider.moduleId);
    if (!providerNode) {
      return;
    }
    enqueueCell(providerNode, provider.cellId);
  };

  const activateFile = (node: ModuleNode) => {
    if (activatedFiles.has(node.id)) {
      return;
    }
    activatedFiles.add(node.id);

    for (const cell of getAllCells(node)) {
      if (cell.eager) {
        enqueueCell(node, cell.id);
      }
    }

    for (const importEntry of node.irHeader.imports) {
      if (importEntry.kind === "type") {
        continue;
      }
      const sourceId = node.resolvedSources.get(importEntry.source);
      if (!sourceId) {
        continue;
      }
      const sourceNode = graph.nodes.get(sourceId);
      if (sourceNode) {
        activateFile(sourceNode);
      }
    }

    for (const conditionalImport of node.irHeader.conditionalImports) {
      if (!conditionalImport.elseSource) {
        continue;
      }
      const elseId = node.resolvedSources.get(conditionalImport.elseSource);
      if (!elseId) {
        continue;
      }
      const elseNode = graph.nodes.get(elseId);
      if (elseNode) {
        activateFile(elseNode);
      }
    }
  };

  activateFile(entryNode);
  for (const provider of entryNode.exportTable?.values() ?? []) {
    enqueueProvider(provider);
  }

  while (workQueue.length > 0) {
    const next = workQueue.pop();
    if (!next) {
      continue;
    }
    const node = graph.nodes.get(next.nodeId);
    if (!node) {
      continue;
    }
    const cell = getCellById(node, next.cellId);
    if (!cell) {
      throw new Error(`Missing cell '${next.cellId}' in '${node.id}'.`);
    }

    for (const symbol of cell.internalDeps) {
      const dependencyCell = findCellProvidingSymbol(node, symbol);
      if (dependencyCell) {
        enqueueCell(node, dependencyCell.id);
      }
    }

    for (const provider of cell.providerDeps ?? []) {
      enqueueProvider(provider);
    }

    for (const dependency of cell.externalDeps) {
      const sourceId = node.resolvedSources.get(dependency.source);
      if (!sourceId) {
        continue;
      }
      const sourceNode = graph.nodes.get(sourceId);
      if (!sourceNode) {
        continue;
      }
      activateFile(sourceNode);

      if (dependency.kind === "side-effect") {
        continue;
      }

      if (dependency.imported === "*") {
        for (const provider of sourceNode.exportTable?.values() ?? []) {
          enqueueProvider(provider);
        }
        continue;
      }

      const provider = sourceNode.exportTable?.get(dependency.imported);
      if (!provider) {
        if (sourceNode.ambiguous?.has(dependency.imported)) {
          throw new Error(
            `E_EXPORT_AMBIGUOUS: '${dependency.imported}' is ambiguous in '${sourceNode.id}'.`,
          );
        }
        throw new Error(
          `E_EXPORT_MISSING: '${dependency.imported}' is not exported by '${sourceNode.id}'.`,
        );
      }
      enqueueProvider(provider);
    }
  }

  return selection;
}

function orderSelectedFiles(
  graph: ModuleGraph,
  selection: Map<string, Set<string>>,
): ModuleNode[] {
  const ordered: ModuleNode[] = [];
  const visited = new Set<string>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = graph.nodes.get(nodeId);
    if (!node) {
      return;
    }
    for (const dependencyId of collectSelectedFileDeps(node, selection)) {
      if (selection.has(dependencyId)) {
        visit(dependencyId);
      }
    }
    ordered.push(node);
  };

  for (const nodeId of selection.keys()) {
    visit(nodeId);
  }

  return ordered;
}

function collectSelectedFileDeps(
  node: ModuleNode,
  selection: Map<string, Set<string>>,
): string[] {
  const deps = new Set<string>();

  for (const importEntry of node.irHeader.imports) {
    if (importEntry.kind === "type") {
      continue;
    }
    const sourceId = node.resolvedSources.get(importEntry.source);
    if (sourceId && selection.has(sourceId)) {
      deps.add(sourceId);
    }
  }

  for (const conditionalImport of node.irHeader.conditionalImports) {
    if (!conditionalImport.elseSource) {
      continue;
    }
    const elseId = node.resolvedSources.get(conditionalImport.elseSource);
    if (elseId && selection.has(elseId)) {
      deps.add(elseId);
    }
  }

  const selectedCells = selection.get(node.id);
  if (!selectedCells) {
    return Array.from(deps);
  }

  for (const cellId of selectedCells) {
    const cell = getCellById(node, cellId);
    if (!cell) {
      continue;
    }

    for (const provider of cell.providerDeps ?? []) {
      if (selection.has(provider.moduleId)) {
        deps.add(provider.moduleId);
      }
    }

    for (const dependency of cell.externalDeps) {
      const sourceId = node.resolvedSources.get(dependency.source);
      if (sourceId && selection.has(sourceId)) {
        deps.add(sourceId);
      }
    }
  }

  deps.delete(node.id);
  return Array.from(deps);
}

function collectNamespaceDemands(
  selection: Map<string, Set<string>>,
  graph: ModuleGraph,
): Set<string> {
  const demanded = new Set<string>();

  for (const [nodeId, selectedCells] of selection.entries()) {
    const node = graph.nodes.get(nodeId);
    if (!node) {
      continue;
    }
    for (const cellId of selectedCells) {
      const cell = getCellById(node, cellId);
      if (!cell) {
        continue;
      }
      for (const dependency of cell.externalDeps) {
        if (dependency.kind !== "import" || dependency.imported !== "*") {
          continue;
        }
        const sourceId = node.resolvedSources.get(dependency.source);
        if (sourceId) {
          demanded.add(sourceId);
        }
      }
    }
  }

  return demanded;
}

function collectOrderedCells(
  node: ModuleNode,
  selectedCells: Set<string>,
): CellRecord[] {
  return getAllCells(node)
    .filter((cell) => selectedCells.has(cell.id))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
}

function getAllCells(node: ModuleNode): CellRecord[] {
  return [...node.irHeader.cells, ...(node.generatedCells ?? [])];
}

function getCellById(node: ModuleNode, cellId: string): CellRecord | undefined {
  return getAllCells(node).find((cell) => cell.id === cellId);
}

async function readCellSource(cell: CellRecord): Promise<string> {
  if (cell.code != null) {
    return cell.code;
  }
  if (cell.artifactPath) {
    return fs.readFile(cell.artifactPath, "utf8");
  }
  throw new Error(`Cell '${cell.id}' is missing code and artifactPath.`);
}

function findCellProvidingSymbol(
  node: ModuleNode,
  symbol: string,
): CellRecord | undefined {
  return getAllCells(node).find((cell) => cell.provides.includes(symbol));
}

function collectDynamicImportExports(
  node: ModuleNode | undefined,
): Array<{ exported: string; symbol: string }> {
  if (!node?.exportTable) {
    return [];
  }

  return Array.from(node.exportTable.entries()).map(([exported, provider]) => ({
    exported,
    symbol: provider.symbol,
  }));
}

function emitEntryExports(node: ModuleNode | undefined): string {
  if (!node?.exportTable || node.exportTable.size === 0) {
    return "";
  }

  const parts: string[] = [];
  for (const [exported, provider] of node.exportTable.entries()) {
    parts.push(
      provider.symbol === exported
        ? provider.symbol
        : `${provider.symbol} as ${exported}`,
    );
  }

  return `export { ${parts.join(", ")} };`;
}

function emitDynamicBundleExports(
  nodes: ModuleNode[],
  selection: Map<string, Set<string>>,
): string {
  const exportedSymbols = new Set<string>();

  for (const node of nodes) {
    if (!node.exportTable) {
      continue;
    }
    const selectedCells = selection.get(node.id);
    if (!selectedCells) {
      continue;
    }
    for (const provider of node.exportTable.values()) {
      if (selectedCells.has(provider.cellId)) {
        exportedSymbols.add(provider.symbol);
      }
    }
  }

  if (exportedSymbols.size === 0) {
    return "";
  }

  return `export { ${Array.from(exportedSymbols).join(", ")} };`;
}

function dedupeResolved(results: ResolveResult[]): ResolveResult[] {
  const deduped = new Map<string, ResolveResult>();
  for (const result of results) {
    deduped.set(result.resolvedPath, result);
  }
  return Array.from(deduped.values());
}

function dedupeDynamicEntries(
  results: DynamicEntryDiscovery[],
): DynamicEntryDiscovery[] {
  const deduped = new Map<string, DynamicEntryDiscovery>();
  for (const result of results) {
    deduped.set(`${result.envId}:${result.resolvedPath}`, result);
  }
  return Array.from(deduped.values());
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const deduped = new Map<string, Diagnostic>();
  for (const diagnostic of diagnostics) {
    deduped.set(
      JSON.stringify([
        diagnostic.code,
        diagnostic.message,
        diagnostic.file,
        diagnostic.line,
        diagnostic.column,
        diagnostic.envId,
      ]),
      diagnostic,
    );
  }
  return Array.from(deduped.values());
}

function resolveWorkerCount(configured: number): number {
  const cpuCount = Math.max(1, availableParallelism());
  return Math.max(1, Math.min(configured, cpuCount));
}
