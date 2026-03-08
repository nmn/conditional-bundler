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
import { applyReplacements } from "./linker/rewriter.js";
import {
  emitConditionalStart,
  emitConditionalEnd,
} from "./linker/conditional-markers.js";
import { emitNamespaceObject } from "./linker/namespace.js";
import {
  emitDynamicImportConstants,
  type BundleTarget,
} from "./linker/dynamic-import-constants.js";
import { stripImportStatements } from "./linker/strip-imports.js";
import { concatParts } from "./concat.js";
import { runTransformModule, runTransformModuleGraph } from "./plugins/run.js";
import type { BundlerConfig, EntrySpec } from "./config.js";
import {
  readPkgSafe,
  findPkgRoot,
  contentHashShort,
  type Diagnostic,
} from "@bundler/shared";
import type { BundlerPlugin } from "./plugins/types.js";
import type { ModuleGraph } from "./graph/build.js";
import type {
  ModuleNode,
  Provider,
  IRHeader,
  ImportSpecifier,
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
  irHeader: IRHeader;
};

type DynamicEntryDiscovery = ResolveResult & {
  envId: string;
};

type ModuleCollection = {
  headers: IRHeader[];
  dynamicEntries: EntrySpec[];
  resolvedMap: Map<string, string>;
};

export async function buildProject(
  config: BundlerConfig,
  plugins: BundlerPlugin[],
): Promise<BuildResult> {
  const cacheDir = path.resolve(config.cacheDir ?? path.join("tmp", ".bundler-cache"));
  const explicitEntries = collectEntries(config.entries);
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
    await fs.mkdir(cacheDir, { recursive: true });
    const { headers, dynamicEntries, resolvedMap } = await collectTransformedModules(
      explicitEntries,
      envs,
      cacheDir,
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
  const ordered = topoSort(graph, entryPath);
  if (ordered.length === 0) {
    throw new Error(`Entry not found in graph: ${entryPath}`);
  }

  const { conditions, diagnostics } = resolveEntryConditions(graph, entryPath);
  const parts: string[] = [];
  const dynamicImports: DynamicImportRef[] = [];

  for (const node of ordered) {
    const codePath =
      node.irHeader.codeByEnv[graph.envId] ?? node.irHeader.codeByEnv.default;
    const code = await fs.readFile(codePath, "utf8");

    const replacements: Array<{ start: number; end: number; text: string }> =
      [];
    for (const importEntry of node.irHeader.imports) {
      for (const spec of importEntry.specifiers) {
        const provider = resolveProvider(graph, node, importEntry, spec);
        if (!provider) {
          continue;
        }
        const targetSymbol = importEntry.condition
          ? `${node.prefix}_${spec.local}`
          : provider.symbol;
        for (const [start, end] of spec.useRanges) {
          replacements.push({ start, end, text: targetSymbol });
        }
      }
    }

    let processed = code;
    if (replacements.length > 0) {
      processed = applyReplacements(processed, replacements);
    }

    processed = stripImportStatements(processed, node.irHeader.importRanges);
    processed = stripImportStatements(processed, node.irHeader.exportRanges);

    const condition = conditions.get(node.id);
    if (condition) {
      parts.push(emitConditionalStart(condition));
    }

    parts.push(processed);

    if (node.irHeader.flags.needsNamespaceObject && node.exportTable) {
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
      : emitDynamicBundleExports(ordered);
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
  const headers = new Map<string, IRHeader>();
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
  headers: Map<string, IRHeader>,
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
  const irHeader = response.irHeader;
  headers.set(irHeader.id, irHeader);

  if (irHeader.flags.hasTopLevelAwait) {
    throw new Error(
      `E_TLA: Top-level 'await' is not supported (v1). at ${modulePath}`,
    );
  }

  const { dependencies, dynamicEntries } = await discoverModulesFromHeader(
    irHeader,
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
  irHeader: IRHeader,
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

function topoSort(graph: ModuleGraph, entryId: string): ModuleNode[] {
  const visited = new Set<string>();
  const stack: ModuleNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const node = graph.nodes.get(id);
    if (!node) {
      return;
    }
    for (const dep of node.deps) {
      visit(dep);
    }
    stack.push(node);
  }

  const entryNode = graph.nodes.get(entryId);
  if (entryNode) {
    visit(entryNode.id);
  }
  return stack;
}

function resolveProvider(
  graph: ModuleGraph,
  node: ModuleNode,
  importEntry: IRHeader["imports"][number],
  spec: ImportSpecifier,
): Provider | undefined {
  const sourceId = node.resolvedSources.get(importEntry.source);
  if (!sourceId) {
    return undefined;
  }
  const sourceNode = graph.nodes.get(sourceId);
  if (!sourceNode?.exportTable) {
    return undefined;
  }
  if (importEntry.isNamespace && importEntry.namespaceUsage === "dynamic") {
    return {
      moduleId: sourceNode.id,
      symbol: `__NS__${sourceNode.prefix}`,
    };
  }
  const provider = sourceNode.exportTable.get(spec.imported);
  if (!provider) {
    return undefined;
  }
  return provider;
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

function emitDynamicBundleExports(nodes: ModuleNode[]): string {
  const exportedSymbols = new Set<string>();

  for (const node of nodes) {
    if (!node.exportTable) {
      continue;
    }
    for (const provider of node.exportTable.values()) {
      exportedSymbols.add(provider.symbol);
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
