import fs from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import { createResolver, type Resolver } from "./resolver.js";
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
import type { BundleManifest } from "./manifest.js";
import { normalizePlugins } from "./plugins/normalize.js";
import { scanModuleRequests } from "./plugins/scan.js";
import {
  runAfterCombine,
  runBeforeCombine,
  runBuildEnd,
  runBuildStart,
  runLoad,
} from "./plugins/run.js";
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
import type {
  BundlerPlugin,
  BundlePlanDraft,
  EmitFileInput,
  LoadedModuleRecord,
  ModuleResolution,
  NormalizedPlugin,
  WorkerTransformProfile,
} from "./plugins/types.js";
import type { ModuleGraph } from "./graph/build.js";
import type {
  CellRecord,
  ModuleNode,
  Provider,
  FileRecord,
} from "@bundler/shared";

export type BuildResult = {
  bundles: Array<{ envId: string; entryId: string; fileName: string }>;
  manifest: BundleManifest;
  diagnostics: Diagnostic[];
};

type DynamicImportRef = {
  hashKey: string;
  resolvedId: string | null;
  externalRequest?: string;
  exports: Array<{ exported: string; symbol: string }>;
};

type BundlePlan = {
  envId: string;
  entryId: string;
  exportMode: "entry" | "dynamic";
  parts: string[];
  dynamicImports: DynamicImportRef[];
  diagnostics: Diagnostic[];
  modules: string[];
  map?: string;
};

type WorkerTransformResponse = {
  fileRecordsByEnv: Record<string, FileRecord>;
};

type DynamicEntryDiscovery = ModuleResolution & {
  envId: string;
};

type ModuleCollection = {
  headersByEnv: Map<string, Map<string, FileRecord>>;
  dynamicEntries: EntrySpec[];
  resolvedMap: Map<string, ModuleResolution>;
};

type ScheduledModule = {
  id: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  virtual?: boolean;
};

type PendingEmitFile = EmitFileInput & {
  pluginName?: string;
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
  const allPlugins = [...(config.plugins ?? []), ...plugins];
  const pendingFiles: PendingEmitFile[] = [];
  const { plugins: normalizedPlugins, workerProfile } =
    await normalizePlugins(allPlugins);
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

  try {
    await runBuildStart(normalizedPlugins, {
      addEntry(entry) {
        explicitEntries.push({
          ...entry,
          path: path.resolve(entry.path),
        });
      },
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    const cacheRoot = await prepareCacheRoot(
      cacheBaseDir,
      config,
      explicitEntries,
      workerProfile,
    );
    const resolver = createResolver({
      config,
      plugins: normalizedPlugins,
      cacheDir: cacheRoot.activeRoot,
    });
    const { headersByEnv, dynamicEntries, resolvedMap } =
      await collectTransformedModules(
        explicitEntries,
        envs,
        cacheRoot.activeRoot,
        normalizedPlugins,
        workerProfile,
        config,
        pool,
        resolver,
      );

    const graphs = await Promise.all(
      envs.map((envId) =>
        buildGraph({
          envId,
          headers: Array.from(headersByEnv.get(envId)?.values() ?? []),
          resolver,
        }),
      ),
    );

    for (const graph of graphs) {
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
    for (const graph of graphs) {
      const entries = pickEntriesForEnv(explicitEntries, graph.envId);
      let drafts: BundlePlanDraft[] = [];
      for (const entry of entries) {
        drafts.push(
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
        drafts.push(
          await createBundlePlan(
            graph,
            resolvedMap.get(entry.path)?.id ?? entry.path,
            config,
            resolver,
            "dynamic",
          ),
        );
      }
      drafts = await runBeforeCombine(normalizedPlugins, {
        envId: graph.envId,
        plans: drafts,
        emitFile(file) {
          pendingFiles.push(file);
        },
      });
      bundlePlans.push(...drafts.map((draft) => fromBundleDraft(draft)));
    }

    const bundleMap = new Map<string, BundleTarget>();
    const bundleOutputs = new Map<
      string,
      { envId: string; entryId: string; fileName: string; modules: string[] }
    >();
    for (const plan of bundlePlans) {
      const finalBundle = await runAfterCombine(normalizedPlugins, {
        envId: plan.envId,
        entryId: plan.entryId,
        exportMode: plan.exportMode,
        code: concatParts(plan.parts),
        map: plan.map,
        emitFile(file) {
          pendingFiles.push(file);
        },
      });
      plan.parts = [finalBundle.code];
      plan.map = finalBundle.map;
      const hash = contentHashShort(finalBundle.code);
      const fileName = config.outputs.fileName
        ? config.outputs.fileName
            .replace("[env]", plan.envId)
            .replace("[hash]", hash)
        : `bundle.${plan.envId}.${hash}.js`;
      bundleMap.set(plan.entryId, {
        fileName,
        exportMode: plan.exportMode,
      });
      bundleOutputs.set(`${plan.envId}:${plan.entryId}`, {
        envId: plan.envId,
        entryId: plan.entryId,
        fileName,
        modules: plan.modules,
      });
    }

    await fs.mkdir(config.outputs.outDir, { recursive: true });
    const bundles: Array<{ envId: string; entryId: string; fileName: string }> =
      [];
    for (const plan of bundlePlans) {
      const bundleOutput = bundleOutputs.get(`${plan.envId}:${plan.entryId}`);
      if (!bundleOutput) {
        throw new Error(
          `Missing finalized bundle output for '${plan.entryId}' in '${plan.envId}'.`,
        );
      }
      const header = emitDynamicImportConstants(plan.dynamicImports, bundleMap);
      const patchedBundle = concatParts([header, ...plan.parts]);

      const outputPath = path.join(
        config.outputs.outDir,
        bundleOutput.fileName,
      );
      await fs.writeFile(outputPath, patchedBundle, "utf8");
      bundles.push({
        envId: plan.envId,
        entryId: plan.entryId,
        fileName: bundleOutput.fileName,
      });
    }

    const diagnostics = dedupeDiagnostics(
      bundlePlans.flatMap((plan) => plan.diagnostics),
    );
    const manifest: BundleManifest = {
      bundles: bundles.map((bundle) => ({
        ...bundle,
        modules:
          bundleOutputs.get(`${bundle.envId}:${bundle.entryId}`)?.modules ?? [],
      })),
      dynamicImports: Object.fromEntries(
        bundles.map((bundle) => [
          `${bundle.envId}:${bundle.entryId}`,
          bundle.fileName,
        ]),
      ),
      emittedFiles: [],
      metadata: {},
    };

    await runBuildEnd(normalizedPlugins, {
      bundles,
      manifest,
      diagnostics,
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    await flushPendingFiles(config.outputs.outDir, pendingFiles, manifest);

    return {
      bundles,
      manifest,
      diagnostics,
    };
  } finally {
    await cleanup();
  }
}

async function prepareCacheRoot(
  cacheBaseDir: string,
  config: BundlerConfig,
  entries: EntrySpec[],
  workerProfile: WorkerTransformProfile,
): Promise<CacheRootInfo> {
  const v2Dir = path.join(cacheBaseDir, "v2");
  await ensureDir(v2Dir);

  const normalizedConfig = normalizeConfigForCache(
    config,
    entries,
    cacheBaseDir,
    workerProfile,
  );
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
  workerProfile: WorkerTransformProfile,
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
    workerProfile,
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

        const metadata = await readJsonIfExists<Partial<CacheRootMetadata>>(
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
  entryId: string,
  _config: BundlerConfig,
  _resolver: Resolver,
  exportMode: "entry" | "dynamic",
): Promise<BundlePlanDraft> {
  const entryNode = graph.nodes.get(entryId);
  if (!entryNode) {
    throw new Error(`Entry not found in graph: ${entryId}`);
  }

  const { conditions, diagnostics } = resolveEntryConditions(graph, entryId);
  const selection = collectBundleSelection(graph, entryId);
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
      const targetNode = dyn.moduleId
        ? graph.nodes.get(dyn.moduleId)
        : undefined;
      dynamicImports.push({
        hashKey: dyn.hashKey,
        resolvedId: dyn.external ? null : (dyn.moduleId ?? null),
        externalRequest: dyn.external ? (dyn.request ?? dyn.source) : undefined,
        exports: collectDynamicImportExports(targetNode),
      });
    }
  }
  const exportFooter =
    exportMode === "entry"
      ? emitEntryExports(graph.nodes.get(entryId))
      : emitDynamicBundleExports(orderedFiles, selection);
  if (exportFooter) {
    parts.push(exportFooter);
  }

  return {
    envId: graph.envId,
    entryId,
    exportMode,
    modules: orderedFiles.map((node) => node.id),
    orderedParts: parts,
    dynamicImports,
    diagnostics,
  };
}

async function collectTransformedModules(
  entries: EntrySpec[],
  envs: string[],
  cacheDir: string,
  plugins: NormalizedPlugin[],
  workerProfile: WorkerTransformProfile,
  config: BundlerConfig,
  pool: WorkerPool,
  resolver: Resolver,
): Promise<ModuleCollection> {
  const headersByEnv = new Map<string, Map<string, FileRecord>>();
  for (const envId of envs) {
    headersByEnv.set(envId, new Map<string, FileRecord>());
  }
  const resolvedMap = new Map<string, ModuleResolution>();
  const scheduled = new Set<string>();
  const dynamicEntries = new Map<string, EntrySpec>();
  const inFlight = new Set<Promise<void>>();

  const schedule = (module: ScheduledModule) => {
    if (scheduled.has(module.id)) {
      return;
    }
    scheduled.add(module.id);
    resolvedMap.set(module.id, {
      id: module.id,
      filePath: module.filePath,
      pkg: module.pkg,
      external: false,
      virtual: module.virtual,
    });
    const task = transformModule(
      module,
      envs,
      cacheDir,
      plugins,
      workerProfile,
      config,
      pool,
      resolver,
      headersByEnv,
      resolvedMap,
      dynamicEntries,
      schedule,
    ).finally(() => {
      inFlight.delete(task);
    });
    inFlight.add(task);
  };

  for (const entry of entries) {
    const filePath = path.resolve(entry.path);
    const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
    schedule({
      id: filePath,
      filePath,
      pkg: readPkgSafe(pkgRoot),
    });
  }

  while (inFlight.size > 0) {
    await Promise.race(inFlight);
  }

  return {
    headersByEnv,
    dynamicEntries: Array.from(dynamicEntries.values()),
    resolvedMap,
  };
}

async function transformModule(
  module: ScheduledModule,
  envs: string[],
  cacheDir: string,
  plugins: NormalizedPlugin[],
  workerProfile: WorkerTransformProfile,
  config: BundlerConfig,
  pool: WorkerPool,
  resolver: Resolver,
  headersByEnv: Map<string, Map<string, FileRecord>>,
  resolvedMap: Map<string, ModuleResolution>,
  dynamicEntries: Map<string, EntrySpec>,
  schedule: (module: ScheduledModule) => void,
): Promise<void> {
  const loadedModule = await loadModuleRecord(module, envs, plugins, config);
  const resolvedImportsByEnv = await resolveImportsForEnvs(
    loadedModule,
    envs,
    resolver,
  );
  const syntax = {
    jsx: module.filePath.endsWith(".jsx") || module.filePath.endsWith(".tsx"),
    ts: module.filePath.endsWith(".ts") || module.filePath.endsWith(".tsx"),
  };
  const response = (await pool.run({
    id: module.id,
    realPath: module.filePath,
    code: loadedModule.code,
    pkg: module.pkg,
    envs,
    cacheDir,
    syntax,
    codeByEnv: loadedModule.codeByEnv,
    mapByEnv: loadedModule.mapByEnv,
    workerProfile,
    resolvedImportsByEnv,
  })) as WorkerTransformResponse;
  for (const [envId, fileRecord] of Object.entries(response.fileRecordsByEnv)) {
    headersByEnv.get(envId)?.set(fileRecord.id, fileRecord);

    if (fileRecord.flags.hasTopLevelAwait) {
      throw new Error(
        `E_TLA: Top-level 'await' is not supported (v1). at ${module.filePath}`,
      );
    }

    const { dependencies, dynamicEntries: discoveredDynamics } =
      await discoverModulesFromHeader(fileRecord, envId, resolver);

    for (const resolved of dependencies) {
      resolvedMap.set(resolved.id, resolved);
      schedule({
        id: resolved.id,
        filePath: resolved.filePath,
        pkg: resolved.pkg,
        virtual: resolved.virtual,
      });
    }

    for (const dynamicEntry of discoveredDynamics) {
      resolvedMap.set(dynamicEntry.id, dynamicEntry);
      const existing = dynamicEntries.get(dynamicEntry.id);
      if (existing) {
        existing.envs = Array.from(new Set([...(existing.envs ?? []), envId]));
      } else {
        dynamicEntries.set(dynamicEntry.id, {
          id: dynamicEntry.id,
          path: dynamicEntry.filePath,
          envs: [envId],
        });
      }
      schedule({
        id: dynamicEntry.id,
        filePath: dynamicEntry.filePath,
        pkg: dynamicEntry.pkg,
        virtual: dynamicEntry.virtual,
      });
    }
  }
}

async function discoverModulesFromHeader(
  irHeader: FileRecord,
  envId: string,
  resolver: Resolver,
): Promise<{
  dependencies: ModuleResolution[];
  dynamicEntries: DynamicEntryDiscovery[];
}> {
  const dependencyPromises: Array<Promise<ModuleResolution>> = [];
  const dynamicPromises: Array<Promise<DynamicEntryDiscovery>> = [];

  for (const importEntry of irHeader.imports) {
    if (importEntry.kind === "type" || importEntry.external) {
      continue;
    }
    dependencyPromises.push(
      resolver(
        irHeader.id,
        irHeader.filePath,
        importEntry.request ?? importEntry.source,
        envId,
        importEntry.condition ? "conditional-import" : "import",
        importEntry.attributes ?? undefined,
      ),
    );
  }

  for (const conditionalImport of irHeader.conditionalImports) {
    if (!conditionalImport.elseSource || conditionalImport.elseExternal) {
      continue;
    }
    dependencyPromises.push(
      resolver(
        irHeader.id,
        irHeader.filePath,
        conditionalImport.elseRequest ?? conditionalImport.elseSource,
        envId,
        "conditional-else",
      ),
    );
  }

  for (const reexport of [
    ...irHeader.exportStars,
    ...irHeader.reexportsNamed,
  ]) {
    if (reexport.external) {
      continue;
    }
    dependencyPromises.push(
      resolver(
        irHeader.id,
        irHeader.filePath,
        reexport.request ?? reexport.source,
        envId,
        "reexport",
      ),
    );
  }

  for (const dynamicImport of irHeader.dynamicImports) {
    if (dynamicImport.external) {
      continue;
    }
    dynamicPromises.push(
      resolver(
        irHeader.id,
        irHeader.filePath,
        dynamicImport.request ?? dynamicImport.source,
        envId,
        "dynamic-import",
      ).then((resolved) => ({
        ...resolved,
        envId,
      })),
    );
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

async function loadModuleRecord(
  module: ScheduledModule,
  envs: string[],
  plugins: NormalizedPlugin[],
  config: BundlerConfig,
): Promise<LoadedModuleRecord> {
  const syntax = {
    jsx: module.filePath.endsWith(".jsx") || module.filePath.endsWith(".tsx"),
    ts: module.filePath.endsWith(".ts") || module.filePath.endsWith(".tsx"),
  };
  let code: string | undefined;
  const codeByEnv: Record<string, string> = {};
  const mapByEnv: Record<string, string> = {};

  for (const envId of envs) {
    const envConfig = config.envs[envId];
    const loaded = await runLoad(plugins, envId, {
      id: module.id,
      filePath: module.filePath,
      envId,
      target: envConfig.target,
      syntax,
    });
    if (!loaded) {
      continue;
    }
    if (loaded.codeByEnv) {
      Object.assign(codeByEnv, loaded.codeByEnv);
    }
    if (loaded.mapByEnv) {
      Object.assign(mapByEnv, loaded.mapByEnv);
    }
    if (loaded.code) {
      codeByEnv[envId] = loaded.code;
      if (!code) {
        code = loaded.code;
      }
    }
    if (loaded.map) {
      mapByEnv[envId] = loaded.map;
    }
  }

  if (!code) {
    if (module.virtual) {
      throw new Error(
        `Virtual module '${module.id}' at '${module.filePath}' was not provided by any load hook.`,
      );
    }
    code = await fs.readFile(module.filePath, "utf8");
  }

  return {
    id: module.id,
    filePath: module.filePath,
    virtual: module.virtual,
    pkg: module.pkg,
    syntax,
    code,
    codeByEnv: Object.keys(codeByEnv).length > 0 ? codeByEnv : undefined,
    mapByEnv: Object.keys(mapByEnv).length > 0 ? mapByEnv : undefined,
  };
}

async function resolveImportsForEnvs(
  module: LoadedModuleRecord,
  envs: string[],
  resolver: Resolver,
): Promise<
  Record<
    string,
    Record<
      string,
      {
        id: string | null;
        filePath: string | null;
        external: boolean;
        virtual?: boolean;
        meta?: Record<string, unknown>;
      }
    >
  >
> {
  const resolvedByEnv: Record<
    string,
    Record<
      string,
      {
        id: string | null;
        filePath: string | null;
        external: boolean;
        virtual?: boolean;
        meta?: Record<string, unknown>;
      }
    >
  > = {};

  for (const envId of envs) {
    const code = module.codeByEnv?.[envId] ?? module.code;
    const requests = scanModuleRequests({
      code,
      filePath: module.filePath,
      syntax: module.syntax,
    });
    const envResolutions: Record<
      string,
      {
        id: string | null;
        filePath: string | null;
        external: boolean;
        virtual?: boolean;
        meta?: Record<string, unknown>;
      }
    > = {};
    for (const request of requests) {
      const resolved = await resolver(
        module.id,
        module.filePath,
        request.request,
        envId,
        request.kind,
        request.importAttributes,
      );
      envResolutions[request.key] = {
        id: resolved.external ? null : resolved.id,
        filePath: resolved.external ? null : resolved.filePath,
        external: resolved.external,
        virtual: resolved.virtual,
        meta: resolved.meta,
      };
    }
    resolvedByEnv[envId] = envResolutions;
  }

  return resolvedByEnv;
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

function fromBundleDraft(draft: BundlePlanDraft): BundlePlan {
  return {
    envId: draft.envId,
    entryId: draft.entryId,
    exportMode: draft.exportMode,
    parts: draft.orderedParts,
    dynamicImports: draft.dynamicImports.map((dynamicImport) => ({
      hashKey: dynamicImport.hashKey,
      resolvedId: dynamicImport.resolvedId,
      externalRequest: dynamicImport.externalRequest,
      exports: dynamicImport.exports ?? [],
    })),
    diagnostics: draft.diagnostics,
    modules: draft.modules,
  };
}

async function flushPendingFiles(
  outDir: string,
  files: PendingEmitFile[],
  manifest: BundleManifest,
): Promise<void> {
  for (const file of files) {
    const finalName = file.hash
      ? applyHashToFileName(file.fileName, file.contents)
      : file.fileName;
    await fs.writeFile(path.join(outDir, finalName), file.contents, "utf8");
    manifest.emittedFiles.push({
      fileName: finalName,
      originalFileName: file.fileName,
      type: file.type ?? "asset",
      envId: file.envId,
    });
  }
}

function applyHashToFileName(fileName: string, contents: string): string {
  const ext = path.extname(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  return `${base}.${contentHashShort(contents)}${ext}`;
}

function dedupeResolved(results: ModuleResolution[]): ModuleResolution[] {
  const deduped = new Map<string, ModuleResolution>();
  for (const result of results) {
    deduped.set(result.id, result);
  }
  return Array.from(deduped.values());
}

function dedupeDynamicEntries(
  results: DynamicEntryDiscovery[],
): DynamicEntryDiscovery[] {
  const deduped = new Map<string, DynamicEntryDiscovery>();
  for (const result of results) {
    deduped.set(`${result.envId}:${result.id}`, result);
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
