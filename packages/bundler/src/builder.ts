import fs from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import {
  collectResolverAliasCacheIdentity,
  createResolver,
  type Resolver,
} from "./resolver.js";
import { buildGraph } from "./graph/build.js";
import { sourceLookupKey } from "./graph/source-key.js";
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
import {
  emitStaticBundleImports,
  type StaticBundleImport,
} from "./linker/static-bundle-imports.js";
import {
  emitHmrBundleMetadata,
  emitHmrCell,
  emitHmrPrelude,
  emitHmrSymbolDeclarations,
  emitReactRefreshRegistrations,
  type HmrBundleRecord,
  type HmrCellRecord,
} from "./dev/hmr-linker.js";
import { resolveDevOptions, type ResolvedDevOptions } from "./dev/options.js";
import { assembleBundle, stringifySourceMap } from "./sourcemap/compose.js";
import type { BundleManifest } from "./manifest.js";
import { normalizePlugins } from "./plugins/normalize.js";
import { createCssPlugin } from "./plugins/css.js";
import {
  scanModuleRequests,
  type ScannedImportRequest,
} from "./plugins/scan.js";
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
  normalizePosixPath,
  extractConditionNames,
  combineOr,
  readJsonIfExists,
  writeJsonAtomic,
  ensureDir,
  type Diagnostic,
  type ConditionExpr,
  type RemoteCacheConfig,
} from "@bundler/shared";
import type {
  BundlerPlugin,
  BundlePlanDraft,
  EmitFileInput,
  LoadedModuleRecord,
  ModuleResolution,
  NormalizedPlugin,
  WorkerTransformProfile,
  BundlePart,
} from "./plugins/types.js";
import type { ModuleGraph } from "./graph/build.js";
import type {
  CellRecord,
  DiscoveredEntrypoint,
  ModuleNode,
  Provider,
  FileRecord,
} from "@bundler/shared";

export type BuildResult = {
  bundles: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    mapFileName?: string;
  }>;
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
  parts: BundlePart[];
  staticImports: StaticBundleImport[];
  dynamicImports: DynamicImportRef[];
  diagnostics: Diagnostic[];
  modules: string[];
  conditions: Array<{ moduleId: string; condition: ConditionExpr }>;
  conditionNames: string[];
  hmr?: HmrBundleRecord;
};

type BundleEntry = {
  entryId: string;
  exportMode: "entry" | "dynamic";
};

type BundlePartition = BundleEntry & {
  entryNodeId?: string;
  selection: Map<string, Set<string>>;
  conditions: Map<string, ConditionExpr | undefined>;
  namespaceDemanded: Set<string>;
  staticImports: StaticBundleImport[];
  internalExports: Set<string>;
  diagnostics: Diagnostic[];
};

type ResolvedSourceMapOutput = {
  mode: "external" | "hidden";
  sourcesContent: boolean;
};

type BundlePlanDraftWithHmr = BundlePlanDraft & {
  hmr?: HmrBundleRecord;
};

type WorkerTransformResponse = {
  cacheHit?: boolean;
  needsResolution?: boolean;
  unresolvedImportsByEnv?: Record<string, ScannedImportRequest[]>;
  fileRecordsByEnv: Record<string, FileRecord>;
};

type DynamicEntryDiscovery = ModuleResolution & {
  envId: string;
  entryId?: string;
  entryEnvs?: string[];
};

type ModuleCollection = {
  headersByEnv: Map<string, Map<string, FileRecord>>;
  dynamicEntries: EntrySpec[];
  resolvedMap: Map<string, ModuleResolution>;
  fileRecords: FileRecord[];
};

type ScheduledModule = {
  id: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  envId: string;
  virtual?: boolean;
};

type PendingEmitFile = EmitFileInput & {
  pluginName?: string;
};

type CacheRootInfo = {
  activeRoot: string;
  configHash: string;
  remote?: RemoteCacheConfig;
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
  const userPlugins = [...(config.plugins ?? []), ...plugins];
  const allPlugins = [...createBuiltinPlugins(config), ...userPlugins];
  const sourceMapOutput = resolveSourceMapOutput(config.outputs.sourceMap);
  const pendingFiles: PendingEmitFile[] = [];
  const { plugins: normalizedPlugins, workerProfile } =
    await normalizePlugins(allPlugins);
  const cacheBaseDir = path.resolve(
    config.cache?.local?.dir ??
      config.cacheDir ??
      path.join("tmp", ".bundler-cache"),
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
    const devOptions = await resolveDevOptions(config, explicitEntries);
    const cacheRoot = await prepareCacheRoot(
      cacheBaseDir,
      config,
      explicitEntries,
      workerProfile,
      userPlugins,
    );
    const resolver = createResolver({
      config,
      plugins: normalizedPlugins,
      cacheDir: cacheRoot.activeRoot,
    });
    const { headersByEnv, dynamicEntries, resolvedMap, fileRecords } =
      await collectTransformedModules(
        explicitEntries,
        envs,
        cacheRoot.activeRoot,
        cacheRoot.configHash,
        cacheRoot.remote,
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
      resolveExportTables(Array.from(graph.nodes.values()), graph.nodes, {
        hmr: devOptions.hmr,
      });
    }

    const bundlePlans: BundlePlan[] = [];
    for (const graph of graphs) {
      const entries = pickEntriesForEnv(explicitEntries, graph.envId);
      const bundleEntries: BundleEntry[] = entries.map((entry) => ({
        entryId: entry.path,
        exportMode: "entry",
      }));
      const dynamicForEnv = dynamicEntries.filter(
        (entry) => entry.envs?.includes(graph.envId) || !entry.envs,
      );
      for (const entry of dynamicForEnv) {
        if (entries.some((explicit) => explicit.path === entry.path)) {
          continue;
        }
        bundleEntries.push({
          entryId: resolvedMap.get(entry.path)?.id ?? entry.path,
          exportMode: "dynamic",
        });
      }
      const partitions = createBundlePartitions(graph, bundleEntries);
      let drafts = await Promise.all(
        partitions.map((partition) =>
          createBundlePlan(graph, partition, devOptions),
        ),
      );
      if (devOptions.hmr) {
        const runtimeEntryId = `bundler:hmr-runtime:${graph.envId}`;
        drafts = drafts.map((draft) => ({
          ...draft,
          staticImports: [
            ...(draft.staticImports ?? []),
            { entryId: runtimeEntryId, symbols: ["__BUNDLER_HMR__"] },
          ],
        }));
        drafts.push(
          createHmrRuntimePlan(graph.envId, runtimeEntryId, config, devOptions),
        );
      }
      drafts = (await runBeforeCombine(normalizedPlugins, {
        envId: graph.envId,
        plans: drafts,
        emitFile(file) {
          pendingFiles.push(file);
        },
      })) as BundlePlanDraftWithHmr[];
      bundlePlans.push(...drafts.map((draft) => fromBundleDraft(draft)));
    }

    const bundleMap = new Map<string, BundleTarget>();
    const bundleOutputs = new Map<
      string,
      { envId: string; entryId: string; fileName: string; modules: string[] }
    >();
    for (const plan of bundlePlans) {
      const assembled = assembleBundle(plan.parts);
      const finalBundle = await runAfterCombine(normalizedPlugins, {
        envId: plan.envId,
        entryId: plan.entryId,
        exportMode: plan.exportMode,
        code: assembled.code,
        map: sourceMapOutput ? stringifySourceMap(assembled.map) : undefined,
        emitFile(file) {
          pendingFiles.push(file);
        },
      });
      plan.parts = [{ code: finalBundle.code, map: finalBundle.map }];
      const hash = contentHashShort(finalBundle.code);
      const fileName = config.outputs.fileName
        ? config.outputs.fileName
            .replace("[entry]", sanitizeOutputName(plan.entryId))
            .replace("[env]", plan.envId)
            .replace("[hash]", hash)
        : `bundle.${plan.envId}.${hash}.js`;
      const target = {
        fileName,
        exportMode: plan.exportMode,
      };
      bundleMap.set(`${plan.envId}:${plan.entryId}`, target);
      if (!bundleMap.has(plan.entryId)) {
        bundleMap.set(plan.entryId, target);
      }
      bundleOutputs.set(`${plan.envId}:${plan.entryId}`, {
        envId: plan.envId,
        entryId: plan.entryId,
        fileName,
        modules: plan.modules,
      });
    }

    await fs.mkdir(config.outputs.outDir, { recursive: true });
    const bundles: Array<{
      envId: string;
      entryId: string;
      fileName: string;
      mapFileName?: string;
    }> = [];
    for (const plan of bundlePlans) {
      const bundleOutput = bundleOutputs.get(`${plan.envId}:${plan.entryId}`);
      if (!bundleOutput) {
        throw new Error(
          `Missing finalized bundle output for '${plan.entryId}' in '${plan.envId}'.`,
        );
      }
      const header = [
        emitStaticBundleImports(plan.staticImports, bundleMap, plan.envId),
        emitDynamicImportConstants(plan.dynamicImports, bundleMap, plan.envId),
      ]
        .filter(Boolean)
        .join("\n");
      const finalParts = [{ code: header }, ...plan.parts];
      const assembled = assembleBundle(finalParts, bundleOutput.fileName);
      const mapFileName = sourceMapOutput
        ? `${bundleOutput.fileName}.map`
        : undefined;
      const patchedBundle =
        sourceMapOutput?.mode === "external" && mapFileName
          ? `${assembled.code}\n//# sourceMappingURL=${path.basename(mapFileName)}`
          : assembled.code;

      const outputPath = path.join(
        config.outputs.outDir,
        bundleOutput.fileName,
      );
      await fs.writeFile(outputPath, patchedBundle, "utf8");
      if (mapFileName) {
        await fs.writeFile(
          path.join(config.outputs.outDir, mapFileName),
          stringifySourceMap(assembled.map),
          "utf8",
        );
      }
      bundles.push({
        envId: plan.envId,
        entryId: plan.entryId,
        fileName: bundleOutput.fileName,
        mapFileName,
      });
    }

    const diagnostics = dedupeDiagnostics(
      bundlePlans.flatMap((plan) => plan.diagnostics),
    );
    const manifest: BundleManifest = {
      bundles: bundles.map((bundle) => ({
        ...bundle,
        type: "script",
        contentType: "text/javascript; charset=utf-8",
        mapFileName: bundle.mapFileName,
        modules:
          bundleOutputs.get(`${bundle.envId}:${bundle.entryId}`)?.modules ?? [],
        conditionNames:
          bundlePlans.find(
            (plan) =>
              plan.envId === bundle.envId && plan.entryId === bundle.entryId,
          )?.conditionNames ?? [],
      })),
      dynamicImports: Object.fromEntries(
        bundles.map((bundle) => [
          `${bundle.envId}:${bundle.entryId}`,
          bundle.fileName,
        ]),
      ),
      emittedFiles: [],
      assets: [
        ...bundles.map((bundle) => {
          const plan = bundlePlans.find(
            (candidate) =>
              candidate.envId === bundle.envId &&
              candidate.entryId === bundle.entryId,
          );
          return {
            fileName: bundle.fileName,
            type: "script" as const,
            contentType: "text/javascript; charset=utf-8",
            envId: bundle.envId,
            entryId: bundle.entryId,
            bundleKey: `${bundle.envId}:${bundle.entryId}`,
            modules:
              bundleOutputs.get(`${bundle.envId}:${bundle.entryId}`)?.modules ??
              [],
            conditionNames: plan?.conditionNames ?? [],
          };
        }),
        ...bundles.flatMap((bundle) =>
          bundle.mapFileName
            ? [
                {
                  fileName: bundle.mapFileName,
                  type: "source-map" as const,
                  contentType: "application/json; charset=utf-8",
                  envId: bundle.envId,
                  entryId: bundle.entryId,
                  bundleKey: `${bundle.envId}:${bundle.entryId}`,
                },
              ]
            : [],
        ),
      ],
      metadata: {
        conditions: {
          byBundle: Object.fromEntries(
            bundlePlans.map((plan) => [
              `${plan.envId}:${plan.entryId}`,
              {
                conditionNames: plan.conditionNames,
                modules: plan.conditions,
              },
            ]),
          ),
        },
        hmr: devOptions.hmr
          ? {
              bundles: Object.fromEntries(
                bundlePlans
                  .filter((plan) => plan.hmr)
                  .map((plan) => [
                    `${plan.envId}:${plan.entryId}`,
                    emitHmrBundleMetadata(plan.hmr as HmrBundleRecord),
                  ]),
              ),
            }
          : undefined,
      },
    };

    await runBuildEnd(normalizedPlugins, {
      bundles,
      manifest,
      diagnostics,
      modules: fileRecords,
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    await flushPendingFiles(config.outputs.outDir, pendingFiles, manifest);
    if (config.outputs.manifestFile) {
      await fs.writeFile(
        path.join(config.outputs.outDir, config.outputs.manifestFile),
        JSON.stringify(manifest, null, 2),
        "utf8",
      );
    }

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
  plugins: BundlerPlugin[],
): Promise<CacheRootInfo> {
  const v2Dir = path.join(cacheBaseDir, "v2");
  await ensureDir(v2Dir);

  const normalizedConfig = normalizeConfigForCache(
    config,
    entries,
    cacheBaseDir,
    workerProfile,
    plugins,
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

  void cleanupObsoleteCacheRoots(
    v2Dir,
    activeRoot,
    now,
    config.cache?.local?.retentionDays ?? 7,
  );

  return {
    activeRoot,
    configHash,
    remote: config.cache?.remote || undefined,
  };
}

function normalizeConfigForCache(
  config: BundlerConfig,
  entries: EntrySpec[],
  cacheBaseDir: string,
  workerProfile: WorkerTransformProfile,
  plugins: BundlerPlugin[],
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
      manifestFile: config.outputs.manifestFile,
      sourceMap: config.outputs.sourceMap,
    },
    workerProfile,
    plugins: serializeConfigValue(plugins),
    configIdentity: serializeConfigValue(config.configIdentity),
    configFile: config.configFile ? path.resolve(config.configFile) : undefined,
    resolverAliases: collectResolverAliasCacheIdentity(config, entries),
    cacheDir: cacheBaseDir,
    mode: process.env.BUNDLER_MODE ?? process.env.NODE_ENV ?? "development",
    cache: serializeConfigValue(config.cache),
    css: config.css,
    maxWorkers: config.maxWorkers,
    diagnostics: config.diagnostics,
    dev: config.dev,
  };
}

function serializeConfigValue(value: unknown): unknown {
  if (typeof value === "function") {
    const source = value.toString();
    const directive = readFunctionCacheDirective(source);
    if (!directive) {
      throw new Error(
        'Inline config/plugin functions must start with a string-literal cache directive, for example "cache-v1";.',
      );
    }
    return {
      __type: "function",
      directive,
      source,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeConfigValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, serializeConfigValue(item)]),
    );
  }
  return value;
}

function resolveSourceMapOutput(
  sourceMap: BundlerConfig["outputs"]["sourceMap"],
): ResolvedSourceMapOutput | null {
  if (!sourceMap) {
    return null;
  }
  if (typeof sourceMap === "string") {
    if (sourceMap !== "external" && sourceMap !== "hidden") {
      throw new Error(`Unsupported source map mode '${sourceMap}'.`);
    }
    return { mode: sourceMap, sourcesContent: true };
  }
  if (sourceMap.mode !== "external" && sourceMap.mode !== "hidden") {
    throw new Error(`Unsupported source map mode '${String(sourceMap.mode)}'.`);
  }
  return {
    mode: sourceMap.mode,
    sourcesContent: sourceMap.sourcesContent ?? true,
  };
}

function readFunctionCacheDirective(source: string): string | null {
  const bodyMatch = source.match(/\{\s*(["'])(.*?)\1\s*;?/s);
  if (bodyMatch) {
    return bodyMatch[2] ?? null;
  }
  const arrowMatch = source.match(/=>\s*(["'])(.*?)\1\s*;?\s*$/s);
  return arrowMatch?.[2] ?? null;
}

async function cleanupObsoleteCacheRoots(
  v2Dir: string,
  activeRoot: string,
  nowIso: string,
  retentionDays: number,
): Promise<void> {
  try {
    const entries = await fs.readdir(v2Dir, { withFileTypes: true });
    const cutoff =
      new Date(nowIso).getTime() -
      Math.max(0, retentionDays) * 24 * 60 * 60 * 1000;

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

function createBuiltinPlugins(config: BundlerConfig): BundlerPlugin[] {
  const plugins: BundlerPlugin[] = [];
  if (config.css !== false) {
    plugins.push(createCssPlugin());
  }

  const refreshEnvs = resolveReactRefreshTransformEnvs(config);
  if (refreshEnvs.length > 0) {
    plugins.push({
      __bundlerPluginRef: true,
      module: fileURLToPath(
        new URL("./plugins/react-refresh.js", import.meta.url),
      ),
      options: { envs: refreshEnvs },
    });
  }
  return plugins;
}

function resolveReactRefreshTransformEnvs(config: BundlerConfig): string[] {
  if (config.dev?.hmr !== true || config.dev.reactRefresh === false) {
    return [];
  }
  const explicit =
    typeof config.dev.reactRefresh === "object"
      ? new Set(config.dev.reactRefresh.envs)
      : null;
  return Object.entries(config.envs)
    .filter(([envId, envConfig]) => {
      if (envConfig.target !== "browser") {
        return false;
      }
      return explicit ? explicit.has(envId) : true;
    })
    .map(([envId]) => envId);
}

function createBundlePartitions(
  graph: ModuleGraph,
  rawEntries: BundleEntry[],
): BundlePartition[] {
  const entries = Array.from(
    new Map(rawEntries.map((entry) => [entry.entryId, entry])).values(),
  );
  const entryIds = new Set(entries.map((entry) => entry.entryId));
  const allEntryIds = entries.map((entry) => entry.entryId).sort();
  const sharedEntryIds = new Set<string>();

  const entryData = entries.map((entry) => {
    if (!graph.nodes.has(entry.entryId)) {
      throw new Error(`Entry not found in graph: ${entry.entryId}`);
    }
    const resolution = resolveEntryConditions(graph, entry.entryId);
    return {
      ...entry,
      selection: collectBundleSelection(graph, entry.entryId),
      conditions: resolution.conditions,
      diagnostics: resolution.diagnostics,
    };
  });

  const consumersByModule = new Map<string, Set<string>>();
  for (const entry of entryData) {
    for (const moduleId of entry.selection.keys()) {
      const consumers = consumersByModule.get(moduleId) ?? new Set<string>();
      consumers.add(entry.entryId);
      consumersByModule.set(moduleId, consumers);
    }
  }

  const ownerByModule = new Map<string, string>();
  for (const [moduleId, consumers] of consumersByModule) {
    if (entryIds.has(moduleId)) {
      ownerByModule.set(moduleId, moduleId);
    } else if (consumers.size > 1) {
      const sharedEntryId = createSharedBundleEntryId(
        graph.envId,
        consumers,
        allEntryIds,
      );
      if (entryIds.has(sharedEntryId)) {
        throw new Error(
          `Reserved bundle entry id '${sharedEntryId}' is in use.`,
        );
      }
      sharedEntryIds.add(sharedEntryId);
      ownerByModule.set(moduleId, sharedEntryId);
    } else {
      ownerByModule.set(moduleId, consumers.values().next().value as string);
    }
  }

  const selectionsByOwner = new Map<string, Map<string, Set<string>>>();
  const conditionStatesByOwner = new Map<
    string,
    Map<string, { unconditional: boolean; conditional: ConditionExpr[] }>
  >();
  const combinedSelection = new Map<string, Set<string>>();

  for (const entry of entryData) {
    for (const [moduleId, cells] of entry.selection) {
      const owner = ownerByModule.get(moduleId);
      if (!owner) {
        continue;
      }
      mergeSelectedCells(selectionsByOwner, owner, moduleId, cells);
      const combinedCells =
        combinedSelection.get(moduleId) ?? new Set<string>();
      for (const cellId of cells) {
        combinedCells.add(cellId);
      }
      combinedSelection.set(moduleId, combinedCells);

      const states =
        conditionStatesByOwner.get(owner) ??
        new Map<
          string,
          { unconditional: boolean; conditional: ConditionExpr[] }
        >();
      const state = states.get(moduleId) ?? {
        unconditional: false,
        conditional: [],
      };
      const condition = entry.conditions.get(moduleId);
      if (condition === undefined) {
        state.unconditional = true;
      } else {
        state.conditional.push(condition);
      }
      states.set(moduleId, state);
      conditionStatesByOwner.set(owner, states);
    }
  }

  const importsByOwner = new Map<string, Map<string, Set<string>>>();
  const internalExportsByOwner = new Map<string, Set<string>>();
  const addBundleDependency = (
    owner: string,
    targetOwner: string,
    symbol?: string,
  ) => {
    if (owner === targetOwner) {
      return;
    }
    const imports = importsByOwner.get(owner) ?? new Map<string, Set<string>>();
    const symbols = imports.get(targetOwner) ?? new Set<string>();
    if (symbol) {
      symbols.add(symbol);
      const exports = internalExportsByOwner.get(targetOwner) ?? new Set();
      exports.add(symbol);
      internalExportsByOwner.set(targetOwner, exports);
    }
    imports.set(targetOwner, symbols);
    importsByOwner.set(owner, imports);
  };

  for (const entry of entryData) {
    for (const moduleId of entry.selection.keys()) {
      const node = graph.nodes.get(moduleId);
      const owner = ownerByModule.get(moduleId);
      if (!node || !owner) {
        continue;
      }
      for (const dependencyId of collectSelectedFileDeps(
        node,
        entry.selection,
      )) {
        const targetOwner = ownerByModule.get(dependencyId);
        if (targetOwner) {
          addBundleDependency(owner, targetOwner);
        }
      }
    }
  }

  for (const [owner, selection] of selectionsByOwner) {
    for (const [moduleId, cells] of selection) {
      const node = graph.nodes.get(moduleId);
      if (!node) {
        continue;
      }
      for (const cellId of cells) {
        const cell = getCellById(node, cellId);
        if (!cell) {
          continue;
        }
        for (const provider of cell.providerDeps ?? []) {
          const targetOwner = ownerByModule.get(provider.moduleId);
          if (targetOwner) {
            addBundleDependency(owner, targetOwner, provider.symbol);
          }
        }
        for (const dependency of cell.externalDeps) {
          if (dependency.kind !== "import") {
            continue;
          }
          const sourceId = node.resolvedSources.get(
            sourceLookupKey(dependency),
          );
          const sourceNode = sourceId ? graph.nodes.get(sourceId) : undefined;
          const targetOwner = sourceId
            ? ownerByModule.get(sourceId)
            : undefined;
          if (!sourceNode || !targetOwner || targetOwner === owner) {
            continue;
          }
          if (dependency.imported === "*") {
            addBundleDependency(
              owner,
              targetOwner,
              `__NS__${sourceNode.prefix}`,
            );
            continue;
          }
          const provider = sourceNode.exportTable?.get(dependency.imported);
          if (provider) {
            addBundleDependency(owner, targetOwner, provider.symbol);
          }
        }
      }
    }
  }

  const allNamespaceDemands = collectNamespaceDemands(combinedSelection, graph);
  const namespaceDemandsByOwner = new Map<string, Set<string>>();
  for (const moduleId of allNamespaceDemands) {
    const owner = ownerByModule.get(moduleId);
    if (!owner) {
      continue;
    }
    const demands = namespaceDemandsByOwner.get(owner) ?? new Set<string>();
    demands.add(moduleId);
    namespaceDemandsByOwner.set(owner, demands);
  }

  return [
    ...entries.map((entry) => ({ ...entry, entryNodeId: entry.entryId })),
    ...Array.from(sharedEntryIds)
      .sort()
      .map((entryId) => ({
        entryId,
        exportMode: "dynamic" as const,
      })),
  ].map((entry) => {
    const conditionStates = conditionStatesByOwner.get(entry.entryId);
    const conditions = new Map<string, ConditionExpr | undefined>();
    for (const [moduleId, state] of conditionStates ?? []) {
      conditions.set(
        moduleId,
        state.unconditional ? undefined : combineOr(state.conditional),
      );
    }
    const imports = importsByOwner.get(entry.entryId);
    return {
      ...entry,
      selection: selectionsByOwner.get(entry.entryId) ?? new Map(),
      conditions,
      namespaceDemanded:
        namespaceDemandsByOwner.get(entry.entryId) ?? new Set(),
      staticImports: Array.from(
        imports?.entries() ?? [],
        ([entryId, symbols]) => ({
          entryId,
          symbols: Array.from(symbols).sort(),
        }),
      ),
      internalExports:
        internalExportsByOwner.get(entry.entryId) ?? new Set<string>(),
      diagnostics:
        entryData.find((candidate) => candidate.entryId === entry.entryId)
          ?.diagnostics ?? [],
    };
  });
}

function createSharedBundleEntryId(
  envId: string,
  consumers: Set<string>,
  allEntryIds: string[],
): string {
  const consumerIds = Array.from(consumers).sort();
  if (
    consumerIds.length === allEntryIds.length &&
    consumerIds.every((entryId, index) => entryId === allEntryIds[index])
  ) {
    return `bundler:common:${envId}`;
  }
  return `bundler:common:${envId}:${contentHashShort(consumerIds.join("\0"))}`;
}

function mergeSelectedCells(
  selectionsByOwner: Map<string, Map<string, Set<string>>>,
  owner: string,
  moduleId: string,
  cells: Set<string>,
): void {
  const selection =
    selectionsByOwner.get(owner) ?? new Map<string, Set<string>>();
  const selectedCells = selection.get(moduleId) ?? new Set<string>();
  for (const cellId of cells) {
    selectedCells.add(cellId);
  }
  selection.set(moduleId, selectedCells);
  selectionsByOwner.set(owner, selection);
}

async function createBundlePlan(
  graph: ModuleGraph,
  partition: BundlePartition,
  devOptions: ResolvedDevOptions,
): Promise<BundlePlanDraftWithHmr> {
  const { entryId, exportMode, conditions, diagnostics, selection } = partition;
  const entryNode = partition.entryNodeId
    ? graph.nodes.get(partition.entryNodeId)
    : undefined;
  if (partition.entryNodeId && !entryNode) {
    throw new Error(`Entry not found in graph: ${partition.entryNodeId}`);
  }

  const conditionRecordsForGraph = Array.from(conditions.entries())
    .filter((entry): entry is [string, ConditionExpr] => entry[1] !== undefined)
    .map(([moduleId, condition]) => ({ moduleId, condition }));
  const orderedFiles = orderSelectedFiles(graph, selection);
  const orderedFileIds = new Set(orderedFiles.map((node) => node.id));
  const conditionRecords = conditionRecordsForGraph.filter((record) =>
    orderedFileIds.has(record.moduleId),
  );
  const conditionNames = Array.from(
    new Set(
      conditionRecords.flatMap((record) =>
        extractConditionNames(record.condition),
      ),
    ),
  ).sort();
  const parts: BundlePart[] = [];
  const dynamicImports: DynamicImportRef[] = [];
  const namespaceDemanded = partition.namespaceDemanded;
  const hmrCells: HmrCellRecord[] = [];
  const hmrSymbols = new Set<string>();
  const useHmr = devOptions.hmr;
  const useReactRefresh = devOptions.reactRefreshEnvs.has(graph.envId);
  const conditionalExportAliases = new Map<string, string>();
  const conditionalAliasNames = new Set<string>();

  for (const node of orderedFiles) {
    const selectedCells = selection.get(node.id);
    if (!selectedCells || selectedCells.size === 0) {
      continue;
    }
    for (const cell of collectOrderedCells(node, selectedCells)) {
      for (const symbol of cell.provides) {
        hmrSymbols.add(symbol);
      }
    }
  }

  if (useHmr) {
    const declarations = emitHmrSymbolDeclarations(hmrSymbols);
    if (declarations) {
      parts.push({ code: declarations });
    }
  }
  for (const node of orderedFiles) {
    if (!conditions.get(node.id)) {
      continue;
    }
    const selectedCells = selection.get(node.id);
    if (!selectedCells) {
      continue;
    }
    const provided = new Set(
      collectOrderedCells(node, selectedCells).flatMap((cell) => cell.provides),
    );
    if (namespaceDemanded.has(node.id)) {
      provided.add(`__NS__${node.prefix}`);
    }
    for (const symbol of partition.internalExports) {
      if (provided.has(symbol) && !conditionalExportAliases.has(symbol)) {
        let alias = `__bundler_conditional_export_${contentHashShort(symbol)}`;
        while (hmrSymbols.has(alias) || conditionalAliasNames.has(alias)) {
          alias += "_";
        }
        conditionalAliasNames.add(alias);
        conditionalExportAliases.set(symbol, alias);
      }
    }
  }
  if (conditionalExportAliases.size > 0) {
    parts.push({
      code: `let ${Array.from(conditionalExportAliases.values()).join(", ")};`,
    });
  }

  for (const node of orderedFiles) {
    const selectedCells = selection.get(node.id);
    if (!selectedCells || selectedCells.size === 0) {
      continue;
    }
    const condition = conditions.get(node.id);
    if (condition) {
      parts.push({ code: emitConditionalStart(condition) });
    }

    const orderedCells = useHmr
      ? collectDependencyOrderedCells(node, selectedCells)
      : collectOrderedCells(node, selectedCells);
    const cellParts = useHmr
      ? await Promise.all(
          orderedCells.map(async (cell) => {
            const hmrCell = await emitHmrCell(
              cell,
              collectExternalIdentifierDeps(graph, node, cell),
            );
            hmrCells.push(hmrCell);
            return { code: hmrCell.code, map: hmrCell.map };
          }),
        )
      : await Promise.all(orderedCells.map(readCellPart));
    parts.push(...cellParts.filter((part) => part.code.length > 0));

    if (namespaceDemanded.has(node.id) && node.exportTable) {
      parts.push({ code: emitNamespaceObject(node) });
    }
    if (useHmr && useReactRefresh) {
      const registrations = emitReactRefreshRegistrations(node, selectedCells);
      if (registrations) {
        parts.push({ code: registrations });
      }
    }

    if (condition && conditionalExportAliases.size > 0) {
      const provided = new Set(orderedCells.flatMap((cell) => cell.provides));
      if (namespaceDemanded.has(node.id)) {
        provided.add(`__NS__${node.prefix}`);
      }
      const assignments = Array.from(conditionalExportAliases)
        .filter(([symbol]) => provided.has(symbol))
        .map(([symbol, alias]) => `${alias} = ${symbol};`)
        .join("\n");
      if (assignments) {
        parts.push({ code: assignments });
      }
    }

    if (condition) {
      parts.push({ code: emitConditionalEnd() });
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
  const exportFooter = emitBundleExports(
    entryNode,
    exportMode,
    useHmr,
    partition.internalExports,
    conditionalExportAliases,
  );
  if (exportFooter) {
    parts.push({ code: exportFooter });
  }

  return {
    envId: graph.envId,
    entryId,
    exportMode,
    modules: orderedFiles.map((node) => node.id),
    conditions: conditionRecords,
    conditionNames,
    orderedParts: parts,
    staticImports: partition.staticImports,
    dynamicImports,
    diagnostics,
    hmr: useHmr
      ? {
          envId: graph.envId,
          entryId,
          reactRefresh: useReactRefresh,
          symbols: Array.from(hmrSymbols).sort(),
          cells: hmrCells,
        }
      : undefined,
  };
}

function createHmrRuntimePlan(
  envId: string,
  entryId: string,
  config: BundlerConfig,
  devOptions: ResolvedDevOptions,
): BundlePlanDraftWithHmr {
  const browser = config.envs[envId]?.target === "browser";
  return {
    envId,
    entryId,
    exportMode: "dynamic",
    modules: [],
    conditions: [],
    conditionNames: [],
    orderedParts: [
      {
        code: emitHmrPrelude({
          connect: browser,
          reactRefresh: browser && devOptions.reactRefreshEnvs.has(envId),
        }),
      },
      { code: "export { __BUNDLER_HMR__ };" },
    ],
    staticImports: [],
    dynamicImports: [],
    diagnostics: [],
  };
}

async function collectTransformedModules(
  entries: EntrySpec[],
  envs: string[],
  cacheDir: string,
  cacheNamespace: string,
  remoteCache: RemoteCacheConfig | undefined,
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
  const fileRecords: FileRecord[] = [];
  const inFlight = new Set<Promise<void>>();

  const schedule = (module: ScheduledModule) => {
    const key = `${module.envId}:${module.id}`;
    if (scheduled.has(key)) {
      return;
    }
    scheduled.add(key);
    resolvedMap.set(module.id, {
      id: module.id,
      filePath: module.filePath,
      pkg: module.pkg,
      external: false,
      virtual: module.virtual,
    });
    const task = transformModule(
      module,
      [module.envId],
      envs,
      cacheDir,
      cacheNamespace,
      remoteCache,
      plugins,
      workerProfile,
      config,
      pool,
      resolver,
      headersByEnv,
      resolvedMap,
      dynamicEntries,
      fileRecords,
      schedule,
    ).finally(() => {
      inFlight.delete(task);
    });
    inFlight.add(task);
  };

  for (const entry of entries) {
    const filePath = path.resolve(entry.path);
    const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
    for (const envId of entry.envs ?? envs) {
      schedule({
        id: filePath,
        filePath,
        envId,
        pkg: readPkgSafe(pkgRoot),
      });
    }
  }

  while (inFlight.size > 0) {
    await Promise.race(inFlight);
  }

  return {
    headersByEnv,
    dynamicEntries: Array.from(dynamicEntries.values()),
    resolvedMap,
    fileRecords,
  };
}

async function transformModule(
  module: ScheduledModule,
  envs: string[],
  allEnvIds: string[],
  cacheDir: string,
  cacheNamespace: string,
  remoteCache: RemoteCacheConfig | undefined,
  plugins: NormalizedPlugin[],
  workerProfile: WorkerTransformProfile,
  config: BundlerConfig,
  pool: WorkerPool,
  resolver: Resolver,
  headersByEnv: Map<string, Map<string, FileRecord>>,
  resolvedMap: Map<string, ModuleResolution>,
  dynamicEntries: Map<string, EntrySpec>,
  fileRecords: FileRecord[],
  schedule: (module: ScheduledModule) => void,
): Promise<void> {
  const loadedModule = await loadModuleRecord(module, envs, plugins, config);
  const syntax = {
    jsx: module.filePath.endsWith(".jsx") || module.filePath.endsWith(".tsx"),
    ts: module.filePath.endsWith(".ts") || module.filePath.endsWith(".tsx"),
  };
  const sourceMapOutput = resolveSourceMapOutput(config.outputs.sourceMap);
  const outputDir = path.resolve(config.outputs.outDir);
  const sourceFileName = module.virtual
    ? `bundler:///${encodeURIComponent(module.id)}`
    : normalizePosixPath(path.relative(outputDir, module.filePath)) ||
      path.basename(module.filePath);
  const requestBase = {
    id: module.id,
    realPath: module.filePath,
    code: loadedModule.code,
    pkg: module.pkg,
    envs,
    cacheDir,
    cacheNamespace,
    remoteCache,
    syntax,
    codeByEnv: loadedModule.codeByEnv,
    mapByEnv: loadedModule.mapByEnv,
    sourceMap: sourceMapOutput
      ? {
          sourceFileName,
          outputDir,
          sourcesContent: sourceMapOutput.sourcesContent,
        }
      : undefined,
    discoveredEntrypointsByEnv: loadedModule.discoveredEntrypointsByEnv,
    extraOutputsByEnv: loadedModule.extraOutputsByEnv,
    workerProfile,
    dev: {
      hmr: config.dev?.hmr === true,
    },
  };
  let response = (await pool.run({
    ...requestBase,
    cacheOnly: true,
  })) as WorkerTransformResponse;
  let resolvedImportsByEnv: Awaited<ReturnType<typeof resolveImportsForEnvs>> =
    {};
  let resolutionPasses = 0;
  while (response.needsResolution) {
    resolutionPasses += 1;
    if (resolutionPasses > 8) {
      throw new Error(
        `Transform plugins kept introducing unresolved imports in '${module.id}'.`,
      );
    }
    const nextResolutions = await resolveImportsForEnvs(
      loadedModule,
      envs,
      resolver,
      response.unresolvedImportsByEnv,
    );
    resolvedImportsByEnv = mergeResolvedImportsByEnv(
      resolvedImportsByEnv,
      nextResolutions,
    );
    response = (await pool.run({
      ...requestBase,
      resolvedImportsByEnv,
    })) as WorkerTransformResponse;
  }
  for (const [envId, fileRecord] of Object.entries(response.fileRecordsByEnv)) {
    headersByEnv.get(envId)?.set(fileRecord.id, fileRecord);
    fileRecords.push(fileRecord);

    if (fileRecord.flags.hasTopLevelAwait) {
      throw new Error(
        `E_TLA: Top-level 'await' is not supported (v1). at ${module.filePath}`,
      );
    }

    const { dependencies, dynamicEntries: discoveredDynamics } =
      await discoverModulesFromHeader(fileRecord, envId, resolver);
    for (const resolved of dependencies) {
      if (resolved.external) {
        continue;
      }
      resolvedMap.set(resolved.id, resolved);
      schedule({
        id: resolved.id,
        filePath: resolved.filePath,
        envId,
        pkg: resolved.pkg,
        virtual: resolved.virtual,
      });
    }

    for (const dynamicEntry of discoveredDynamics) {
      resolvedMap.set(dynamicEntry.id, dynamicEntry);
      const existing = dynamicEntries.get(dynamicEntry.id);
      if (existing) {
        existing.envs = Array.from(
          new Set([
            ...(existing.envs ?? []),
            ...(dynamicEntry.entryEnvs ?? [envId]),
          ]),
        );
      } else {
        dynamicEntries.set(dynamicEntry.id, {
          id: dynamicEntry.entryId ?? dynamicEntry.id,
          path: dynamicEntry.filePath,
          envs: dynamicEntry.entryEnvs ?? [envId],
        });
      }
      for (const targetEnv of dynamicEntry.entryEnvs ?? [envId]) {
        if (!allEnvIds.includes(targetEnv)) {
          continue;
        }
        schedule({
          id: dynamicEntry.id,
          filePath: dynamicEntry.filePath,
          envId: targetEnv,
          pkg: dynamicEntry.pkg,
          virtual: dynamicEntry.virtual,
        });
      }
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
        importEntry.attributes ??
          (typeof importEntry.condition === "string"
            ? { condition: importEntry.condition }
            : undefined),
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
        typeof conditionalImport.condition === "string"
          ? { condition: conditionalImport.condition }
          : undefined,
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

  for (const entrypoint of irHeader.discoveredEntrypoints) {
    if (typeof entrypoint === "string") {
      continue;
    }
    const normalized = normalizeDiscoveredEntrypoint(entrypoint);
    for (const targetEnv of normalized.envs ?? [envId]) {
      dynamicPromises.push(
        resolver(
          irHeader.id,
          irHeader.filePath,
          normalized.request,
          targetEnv,
          "dynamic-import",
        ).then((resolved) => ({
          ...resolved,
          envId: targetEnv,
          entryId: normalized.id,
          entryEnvs: [targetEnv],
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

function normalizeDiscoveredEntrypoint(entry: DiscoveredEntrypoint): {
  id?: string;
  request: string;
  envs?: string[];
} {
  return typeof entry === "string" ? { request: entry } : entry;
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
  const discoveredEntrypointsByEnv: Record<string, DiscoveredEntrypoint[]> = {};
  const extraOutputsByEnv: NonNullable<
    LoadedModuleRecord["extraOutputsByEnv"]
  > = {};

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
    if (loaded.discoveredEntrypoints) {
      discoveredEntrypointsByEnv[envId] = loaded.discoveredEntrypoints;
    }
    if (loaded.extraOutputs) {
      extraOutputsByEnv[envId] = loaded.extraOutputs;
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
    discoveredEntrypointsByEnv:
      Object.keys(discoveredEntrypointsByEnv).length > 0
        ? discoveredEntrypointsByEnv
        : undefined,
    extraOutputsByEnv:
      Object.keys(extraOutputsByEnv).length > 0 ? extraOutputsByEnv : undefined,
  };
}

async function resolveImportsForEnvs(
  module: LoadedModuleRecord,
  envs: string[],
  resolver: Resolver,
  additionalRequestsByEnv: Record<string, ScannedImportRequest[]> = {},
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
    const requests = Array.from(
      new Map(
        [
          ...scanModuleRequests({
            code,
            filePath: module.filePath,
            syntax: module.syntax,
          }),
          ...(additionalRequestsByEnv[envId] ?? []),
        ].map((request) => [request.key, request]),
      ).values(),
    );
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

function mergeResolvedImportsByEnv(
  current: Awaited<ReturnType<typeof resolveImportsForEnvs>>,
  next: Awaited<ReturnType<typeof resolveImportsForEnvs>>,
): Awaited<ReturnType<typeof resolveImportsForEnvs>> {
  const merged = { ...current };
  for (const [envId, resolutions] of Object.entries(next)) {
    merged[envId] = {
      ...(merged[envId] ?? {}),
      ...resolutions,
    };
  }
  return merged;
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
      const sourceId = node.resolvedSources.get(sourceLookupKey(importEntry));
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
      const elseId = node.resolvedSources.get(
        conditionalImport.elseRequest ?? conditionalImport.elseSource,
      );
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
      const sourceId = node.resolvedSources.get(sourceLookupKey(dependency));
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
    const sourceId = node.resolvedSources.get(sourceLookupKey(importEntry));
    if (sourceId && selection.has(sourceId)) {
      deps.add(sourceId);
    }
  }

  for (const conditionalImport of node.irHeader.conditionalImports) {
    if (!conditionalImport.elseSource) {
      continue;
    }
    const elseId = node.resolvedSources.get(
      conditionalImport.elseRequest ?? conditionalImport.elseSource,
    );
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
      const sourceId = node.resolvedSources.get(sourceLookupKey(dependency));
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
        const sourceId = node.resolvedSources.get(sourceLookupKey(dependency));
        if (sourceId) {
          demanded.add(sourceId);
        }
      }
    }
  }

  return demanded;
}

function collectExternalIdentifierDeps(
  graph: ModuleGraph,
  node: ModuleNode,
  cell: CellRecord,
): string[] {
  const deps = new Set<string>();
  for (const dependency of cell.externalDeps) {
    if (dependency.kind !== "import") {
      continue;
    }
    const sourceId = node.resolvedSources.get(sourceLookupKey(dependency));
    if (!sourceId) {
      continue;
    }
    const sourceNode = graph.nodes.get(sourceId);
    if (!sourceNode?.exportTable) {
      continue;
    }
    if (dependency.imported === "*") {
      for (const provider of sourceNode.exportTable.values()) {
        deps.add(provider.symbol);
      }
      continue;
    }
    const provider = sourceNode.exportTable.get(dependency.imported);
    if (provider) {
      deps.add(provider.symbol);
    }
  }
  return Array.from(deps);
}

function collectOrderedCells(
  node: ModuleNode,
  selectedCells: Set<string>,
): CellRecord[] {
  return getAllCells(node)
    .filter((cell) => selectedCells.has(cell.id))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
}

function collectDependencyOrderedCells(
  node: ModuleNode,
  selectedCells: Set<string>,
): CellRecord[] {
  const cells = collectOrderedCells(node, selectedCells);
  const selectedById = new Map(cells.map((cell) => [cell.id, cell]));
  const providerBySymbol = new Map<string, CellRecord>();
  for (const cell of cells) {
    for (const symbol of cell.provides) {
      providerBySymbol.set(symbol, cell);
    }
  }

  const output: CellRecord[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (cell: CellRecord) => {
    if (visited.has(cell.id)) {
      return;
    }
    if (visiting.has(cell.id)) {
      output.push(cell);
      visited.add(cell.id);
      return;
    }
    visiting.add(cell.id);
    for (const symbol of cell.internalDeps) {
      const dependency = providerBySymbol.get(symbol);
      if (dependency && selectedById.has(dependency.id)) {
        visit(dependency);
      }
    }
    visiting.delete(cell.id);
    if (!visited.has(cell.id)) {
      visited.add(cell.id);
      output.push(cell);
    }
  };

  for (const cell of cells) {
    visit(cell);
  }

  return output;
}

function getAllCells(node: ModuleNode): CellRecord[] {
  return [...node.irHeader.cells, ...(node.generatedCells ?? [])];
}

function getCellById(node: ModuleNode, cellId: string): CellRecord | undefined {
  return getAllCells(node).find((cell) => cell.id === cellId);
}

async function readCellPart(cell: CellRecord): Promise<BundlePart> {
  const code =
    cell.code != null
      ? cell.code
      : cell.artifactPath
        ? await fs.readFile(cell.artifactPath, "utf8")
        : null;
  if (code == null) {
    throw new Error(`Cell '${cell.id}' is missing code and artifactPath.`);
  }
  const map =
    cell.map != null
      ? cell.map
      : cell.mapArtifactPath
        ? await fs.readFile(cell.mapArtifactPath, "utf8")
        : undefined;
  return { code, map };
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

function emitBundleExports(
  node: ModuleNode | undefined,
  exportMode: "entry" | "dynamic",
  hmr: boolean,
  internalSymbols: Set<string>,
  internalAliases: Map<string, string> = new Map(),
): string {
  const specifiers: string[] = [];
  const exportedNames = new Set<string>();
  const addExport = (symbol: string, exported: string) => {
    if (exportedNames.has(exported)) {
      return;
    }
    exportedNames.add(exported);
    specifiers.push(symbol === exported ? symbol : `${symbol} as ${exported}`);
  };

  for (const [exported, provider] of node?.exportTable ?? []) {
    if (hmr || exportMode === "dynamic") {
      addExport(provider.symbol, provider.symbol);
    }
    if (hmr || exportMode === "entry") {
      addExport(provider.symbol, exported);
    }
  }
  for (const symbol of Array.from(internalSymbols).sort()) {
    addExport(internalAliases.get(symbol) ?? symbol, symbol);
  }

  return specifiers.length > 0 ? `export { ${specifiers.join(", ")} };` : "";
}

function fromBundleDraft(draft: BundlePlanDraftWithHmr): BundlePlan {
  return {
    envId: draft.envId,
    entryId: draft.entryId,
    exportMode: draft.exportMode,
    parts: draft.orderedParts,
    staticImports: draft.staticImports ?? [],
    dynamicImports: draft.dynamicImports.map((dynamicImport) => ({
      hashKey: dynamicImport.hashKey,
      resolvedId: dynamicImport.resolvedId,
      externalRequest: dynamicImport.externalRequest,
      exports: dynamicImport.exports ?? [],
    })),
    diagnostics: draft.diagnostics,
    modules: draft.modules,
    conditions: draft.conditions,
    conditionNames: draft.conditionNames,
    hmr: draft.hmr,
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
      contentType: file.contentType,
      bundleKey: file.bundleKey,
    });
    manifest.assets?.push({
      fileName: finalName,
      type:
        file.type === "manifest"
          ? "manifest"
          : file.type === "style"
            ? "style"
            : "asset",
      contentType: file.contentType ?? guessContentType(finalName),
      envId: file.envId,
      bundleKey: file.bundleKey,
    });
  }
}

function applyHashToFileName(fileName: string, contents: string): string {
  const ext = path.extname(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  return `${base}.${contentHashShort(contents)}${ext}`;
}

function guessContentType(fileName: string): string {
  const ext = path.extname(fileName);
  switch (ext) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
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

function sanitizeOutputName(value: string): string {
  return path
    .basename(value)
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
}
