import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import { joinRootURL, resolveRootURL } from "./output-url.js";
import { withConditionIdPlaceholder, type OptionSet } from "@bundler/assets";
import {
  collectPackageResolverCacheIdentity,
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
  emitStaticBundleImports,
  type BundleTarget,
  type StaticBundleImport,
} from "./linker/static-bundle-imports.js";
import {
  collectReactRefreshSymbols,
  emitHmrBundleRegistration,
  emitHmrCell,
  emitHmrPrelude,
  emitHmrSymbolDeclarations,
  emitReactRefreshRegistrations,
  type HmrBundleRecord,
  type HmrBuildState,
  type HmrCellRecord,
} from "./dev/hmr-linker.js";
import { resolveDevOptions, type ResolvedDevOptions } from "./dev/options.js";
import { assembleBundle, stringifySourceMap } from "./sourcemap/compose.js";
import type { BundleManifest } from "./manifest.js";
import { normalizePlugins } from "./plugins/normalize.js";
import {
  runAfterCombine,
  runBeforeCombine,
  runBuildEnd,
  runBuildStart,
  runTransformDocument,
  runGenerateBundleResources,
  runPlanBundleResources,
} from "./plugins/run.js";
import {
  buildScopeId,
  type BundleEntryKind,
  normalizeBundlerConfig,
  normalizeEntrySpec,
  type BundlerConfig,
  type InternalBundlerConfig,
  type InternalEntrySpec,
} from "./config.js";
import {
  readPkgSafe,
  findPkgRoot,
  packagePathIdentity,
  contentHash,
  contentHashShort,
  portableSourceName,
  normalizePosixPath,
  extractConditionNames,
  combineOr,
  readJsonIfExists,
  writeJsonAtomic,
  ensureDir,
  type Diagnostic,
  type ConditionExpr,
  type RemoteCacheConfig,
  type LinkReference,
  createRemoteCacheAdapter,
} from "@bundler/shared";
import type {
  BundlerPlugin,
  BundlePlanDraft,
  EmitFileInput,
  ModuleResolution,
  NormalizedPlugin,
  WorkerTransformProfile,
  BundlePart,
  DocumentTransformResult,
} from "./plugins/types.js";

const requireFromBundler = createRequire(import.meta.url);

import type { ModuleGraph } from "./graph/build.js";
import type {
  CellRecord,
  ModuleNode,
  Provider,
  FileRecord,
  ModuleVariantRecord,
} from "@bundler/shared";

export type BuildResult = {
  /** Sorted, deduplicated boolean conditions used anywhere in this build. */
  conditionNames: string[];
  bundles: Array<{
    id: string;
    /** Concrete environment/target scopes contributing to this artifact. */
    scopeIds: string[];
    environmentIds: string[];
    targetIds: string[];
    entrypoints: Array<{
      envId: string;
      environmentId: string;
      targetId: string;
      entryId: string;
      entryKind: BundleEntryKind;
      exportMode: "entry" | "dynamic";
    }>;
    environmentId?: string;
    targetId?: string;
    platform?: "node" | "browser";
    /** Internal concrete scope retained for graph and manifest lookup keys. */
    envId: string;
    entryId: string;
    fileName: string;
    runtimeHash: string;
    exportMode: "entry" | "dynamic";
    entryKind: BundleEntryKind;
    mapFileName?: string;
    modules: string[];
    conditionNames: string[];
    dependencies: string[];
    staticDependencies: string[];
    dynamicDependencies: string[];
    staticFiles: string[];
    dynamicFiles: string[];
  }>;
  entrypoints: BundleManifest["entrypoints"];
  manifest: BundleManifest;
  /** Development-only HMR state. This is intentionally not serialized. */
  hmr?: HmrBuildState;
  diagnostics: Diagnostic[];
};

type BundlePlan = {
  envId: string;
  entryId: string;
  entryKind: BundleEntryKind;
  exportMode: "entry" | "dynamic";
  entrypoints: Array<{
    envId: string;
    entryId: string;
    entryKind: BundleEntryKind;
    exportMode: "entry" | "dynamic";
  }>;
  parts: BundlePart[];
  staticImports: StaticBundleImport[];
  diagnostics: Diagnostic[];
  modules: string[];
  conditions: Array<{ moduleId: string; condition: ConditionExpr }>;
  conditionNames: string[];
  hmr?: HmrBundleRecord;
};

type PhysicalBundlePlan = {
  id: string;
  environmentIds: string[];
  entrypoints: Array<{
    envId: string;
    entryId: string;
    entryKind: BundleEntryKind;
    exportMode: "entry" | "dynamic";
  }>;
  plan: BundlePlan;
};

type PhysicalBundleOutput = {
  plan: PhysicalBundlePlan;
  hash: string;
  fileName: string;
};

function describeBuildScopes(
  scopeIds: string[],
  _primaryScopeId: string,
  config: InternalBundlerConfig,
): {
  scopeIds: string[];
  environmentIds: string[];
  targetIds: string[];
  environmentId?: string;
  targetId?: string;
  platform?: "node" | "browser";
} {
  const environmentIds = Array.from(
    new Set(scopeIds.map((scopeId) => config.envs[scopeId].environmentId)),
  ).sort();
  const targetIds = Array.from(
    new Set(scopeIds.map((scopeId) => config.envs[scopeId].targetId)),
  ).sort();
  const platforms = Array.from(
    new Set(scopeIds.map((scopeId) => config.envs[scopeId].platform)),
  );
  return {
    scopeIds: [...scopeIds],
    environmentIds,
    targetIds,
    ...(environmentIds.length === 1
      ? { environmentId: environmentIds[0] }
      : {}),
    ...(targetIds.length === 1 ? { targetId: targetIds[0] } : {}),
    ...(platforms.length === 1 ? { platform: platforms[0] } : {}),
  };
}

type BundleEntry = {
  entryId: string;
  entryNodeId?: string;
  entryKind: BundleEntryKind;
  exportMode: "entry" | "dynamic";
};

type BundlePartition = BundleEntry & {
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
  variants: ModuleVariantRecord[];
  fileRecordsByEnv: Record<string, FileRecord>;
};

type WorkerImportRequest = {
  key: string;
  kind:
    | "import"
    | "dynamic-import"
    | "reexport"
    | "conditional-import"
    | "conditional-else"
    | "css-import"
    | "css-url";
  request: string;
  importAttributes?: Record<string, string>;
};

type WorkerCoordinatorRequest = {
  type: "resolve-imports";
  requestsByEnv: Record<string, WorkerImportRequest[]>;
};

type DynamicEntryDiscovery = ModuleResolution & {
  envId: string;
  entryId?: string;
  entryEnvs?: string[];
  exportMode?: "entry" | "dynamic";
  entryKind?: BundleEntryKind;
};

type ModuleCollection = {
  headersByEnv: Map<string, Map<string, FileRecord>>;
  dynamicEntries: InternalEntrySpec[];
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>;
  fileRecords: FileRecord[];
};

type ScheduledModule = {
  id: string;
  moduleIdentity: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  envId: string;
  type: ModuleResolution["type"];
  representation?: ModuleResolution["representation"];
  canonicalPath: string;
  meta?: Record<string, unknown>;
  source?: string;
  sourceMap?: string;
  resolveFrom?: string;
};

type PendingEmitFile = EmitFileInput & {
  pluginName?: string;
};

type PlannedOutput = {
  fileName: string;
  contents: string | Uint8Array;
  owner: string;
};

class OutputRegistry {
  readonly #outDir: string;
  readonly #outputs = new Map<string, PlannedOutput>();

  constructor(outDir: string) {
    this.#outDir = path.resolve(outDir);
  }

  add(fileName: string, contents: string | Uint8Array, owner: string): string {
    const normalized = normalizeOutputFileName(fileName);
    const existing = this.#outputs.get(normalized);
    if (existing) {
      const sameOwner = existing.owner === owner;
      const sameContents = Buffer.from(existing.contents).equals(
        Buffer.from(contents),
      );
      if (!sameOwner || !sameContents) {
        throw new Error(
          `Output path collision for '${normalized}' between '${existing.owner}' and '${owner}'.`,
        );
      }
      return normalized;
    }
    this.#outputs.set(normalized, {
      fileName: normalized,
      contents,
      owner,
    });
    return normalized;
  }

  contents(fileName: string): Uint8Array | undefined {
    const normalized = normalizeOutputFileName(fileName);
    const output = this.#outputs.get(normalized);
    return output ? Buffer.from(output.contents) : undefined;
  }

  async flush(): Promise<void> {
    await fs.mkdir(this.#outDir, { recursive: true });
    for (const output of Array.from(this.#outputs.values()).sort(
      (left, right) => left.fileName.localeCompare(right.fileName),
    )) {
      const outputPath = path.join(this.#outDir, output.fileName);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, output.contents);
    }
  }
}

function normalizeOutputFileName(fileName: string): string {
  if (
    !fileName ||
    fileName.includes("\0") ||
    path.isAbsolute(fileName) ||
    /^[a-zA-Z]:[\\/]/.test(fileName)
  ) {
    throw new Error(`Output file name '${fileName}' must be relative.`);
  }
  const portable = fileName.replaceAll("\\", "/");
  const normalized = path.posix.normalize(portable);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    throw new Error(
      `Output file name '${fileName}' escapes the configured output directory.`,
    );
  }
  if (normalized !== portable) {
    throw new Error(
      `Output file name '${fileName}' must not contain redundant or traversal path segments.`,
    );
  }
  return normalized;
}

type CacheRootInfo = {
  activeRoot: string;
  configHash: string;
  transformRoot: string;
  transformHash: string;
  remote?: RemoteCacheConfig;
};

type CacheRootMetadata = {
  configHash: string;
  config: unknown;
  createdAt: string;
  lastUsedAt: string;
};

type StaticAssetOutput = {
  assetId: string;
  fileName: string;
  contents: Uint8Array;
  contentType: string;
};

type DocumentPlan = {
  entryId: string;
  filePath: string;
  envId: string;
  outputFileName?: string;
  result: DocumentTransformResult;
};

export async function buildProject(
  inputConfig: BundlerConfig,
  plugins: BundlerPlugin[],
): Promise<BuildResult> {
  const config: InternalBundlerConfig = {
    ...normalizeBundlerConfig(inputConfig),
    outputs: {
      ...inputConfig.outputs,
      rootURL: resolveRootURL(inputConfig.outputs),
    },
  };
  validateTransformConfig(config);
  const buildMode = resolveBuildMode();
  const explicitEntries = collectEntries(config.entries);
  const userPlugins = [...(config.plugins ?? []), ...plugins];
  const allPlugins = [
    ...createBuiltinPlugins(config),
    ...userPlugins,
    ...createRepresentationFallbackPlugins(),
  ];
  const sourceMapOutput = resolveSourceMapOutput(config.outputs.sourceMap);
  const pendingFiles: PendingEmitFile[] = [];
  const outputRegistry = new OutputRegistry(config.outputs.outDir);
  const { plugins: normalizedPlugins, workerProfile } =
    await normalizePlugins(allPlugins);
  const cacheBaseDir = path.resolve(
    config.cache?.local?.dir ??
      config.cacheDir ??
      path.join("tmp", ".bundler-cache"),
  );
  const debugOutputDir = await prepareDebugOutput(config, cacheBaseDir);
  const envs = Object.keys(config.envs);
  let pool: WorkerPool | undefined;
  const cleanup = async () => {
    await pool?.close();
  };

  try {
    await runBuildStart(normalizedPlugins, {
      addEntry(entry) {
        explicitEntries.push(
          normalizeEntrySpec(
            {
              ...entry,
              path: path.resolve(entry.path),
            },
            config,
          ),
        );
      },
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    const prepared = await prepareDocumentEntries(
      explicitEntries,
      normalizedPlugins,
      config,
      cacheBaseDir,
      workerProfile.fingerprint,
      buildMode,
    );
    explicitEntries.splice(0, explicitEntries.length, ...prepared.entries);
    const workerCount = resolveWorkerCount(config.maxWorkers);
    const initialWorkerCount = Math.min(
      workerCount,
      Math.max(1, explicitEntries.length),
    );
    pool = new WorkerPool({
      workerPath: resolveWorkerPath(),
      size: workerCount,
      initialSize: initialWorkerCount,
    });
    const devOptions = await resolveDevOptions(config, explicitEntries);
    const cacheRoot = await prepareCacheRoot(
      cacheBaseDir,
      config,
      explicitEntries,
      workerProfile,
      userPlugins,
      buildMode,
    );
    const resolver = await createResolver({
      config,
      plugins: normalizedPlugins,
      cacheDir: cacheRoot.activeRoot,
    });
    const { headersByEnv, dynamicEntries, resolvedMapByEnv, fileRecords } =
      await collectTransformedModules(
        explicitEntries,
        envs,
        cacheRoot.transformRoot,
        cacheRoot.transformHash,
        cacheRoot.remote,
        normalizedPlugins,
        workerProfile,
        config,
        buildMode,
        pool,
        resolver,
        debugOutputDir,
      );
    const graphs = await Promise.all(
      envs.map((envId) =>
        buildGraph({
          envId,
          headers: envs
            .filter(
              (candidate) =>
                config.envs[candidate].targetId === config.envs[envId].targetId,
            )
            .flatMap((candidate) =>
              Array.from(headersByEnv.get(candidate)?.values() ?? []),
            ),
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
        hmr: devOptions.hmr && config.envs[graph.envId]?.platform === "browser",
      });
    }

    const bundleEntriesByEnv = new Map<string, BundleEntry[]>();
    for (const graph of graphs) {
      const entries = pickEntriesForEnv(
        explicitEntries,
        graph.envId,
        config.envs[graph.envId]?.platform,
      );
      const bundleEntries: BundleEntry[] = entries.map((entry) => ({
        entryId: entry.path,
        entryNodeId:
          entry.entryNodeId ??
          resolvedMapByEnv.get(graph.envId)?.get(entry.path)?.id ??
          entry.path,
        exportMode: "entry",
        entryKind: "explicit",
      }));
      const dynamicForEnv = pickEntriesForEnv(
        dynamicEntries,
        graph.envId,
        config.envs[graph.envId]?.platform,
      );
      for (const entry of dynamicForEnv) {
        if (entries.some((explicit) => explicit.path === entry.path)) {
          continue;
        }
        bundleEntries.push({
          entryId: entry.id,
          entryNodeId:
            entry.entryNodeId ??
            resolvedMapByEnv.get(graph.envId)?.get(entry.path)?.id ??
            entry.path,
          exportMode: "dynamic",
          entryKind:
            entry.entryKind === "shared" || entry.entryKind === "manual"
              ? entry.entryKind
              : "dynamic",
        });
      }
      bundleEntriesByEnv.set(graph.envId, bundleEntries);
    }
    const ownerMapsByEnv = createCrossEnvironmentOwnerMaps(
      graphs,
      bundleEntriesByEnv,
      normalizedPlugins,
      config,
    );

    let bundlePlans: BundlePlan[] = [];
    for (const graph of graphs) {
      const partitions = createBundlePartitions(
        graph,
        bundleEntriesByEnv.get(graph.envId) ?? [],
        ownerMapsByEnv.get(graph.envId),
      );
      let drafts = await Promise.all(
        partitions.map((partition) =>
          createBundlePlan(
            graph,
            partition,
            devOptions,
            config.envs[graph.envId]?.platform === "browser",
          ),
        ),
      );
      if (
        devOptions.hmr &&
        config.envs[graph.envId]?.platform === "browser" &&
        drafts.length > 0
      ) {
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
      drafts = drafts.map((draft) =>
        prependLinkReferencePrelude(draft, config.envs[graph.envId].platform),
      );
      bundlePlans.push(...drafts.map((draft) => fromBundleDraft(draft)));
    }

    const conditionNames = Array.from(
      new Set(bundlePlans.flatMap((plan) => plan.conditionNames)),
    ).sort();
    const conditionOptionSet: OptionSet = { conditions: conditionNames };
    pendingFiles.push({
      fileName: "conditions.json",
      contents: JSON.stringify(conditionNames, null, 2),
      type: "manifest",
      contentType: "application/json; charset=utf-8",
      global: conditionNames.length > 0 ? true : undefined,
    });

    const usedAssetIds = collectUsedAssetIds(
      bundlePlans,
      fileRecords,
      prepared.documents,
    );
    const staticAssets = dedupeStaticAssets([
      ...(await collectStaticAssetOutputs(fileRecords, config, usedAssetIds)),
      ...prepared.assets,
    ]);
    const staticAssetFileNames = new Map(
      staticAssets.map((asset) => [asset.assetId, asset.fileName]),
    );
    for (const asset of staticAssets) {
      pendingFiles.push({
        fileName: asset.fileName,
        contents: asset.contents,
        type: "asset",
        contentType: asset.contentType,
      });
    }
    pendingFiles.push(
      ...(await collectDeclaredExtraOutputs(
        fileRecords,
        staticAssetFileNames,
        config,
      )),
    );
    const bundleMap = new Map<string, BundleTarget>();
    for (const plan of bundlePlans) {
      const assembled = assembleBundle(plan.parts);
      const references = dedupeBundleReferences(plan.parts);
      const finalBundle = await runAfterCombine(normalizedPlugins, {
        envId: plan.envId,
        entryId: plan.entryId,
        entryKind: plan.entryKind,
        exportMode: plan.exportMode,
        code: assembled.code,
        map: sourceMapOutput ? stringifySourceMap(assembled.map) : undefined,
        references,
        emitFile(file) {
          pendingFiles.push(file);
        },
      });
      plan.parts = [
        {
          code: finalBundle.code,
          map: finalBundle.map,
          references: finalBundle.references,
        },
      ];
    }
    if (!devOptions.hmr) {
      bundlePlans = groupCrossScopeDynamicBundlePlans(
        bundlePlans,
        resolvedMapByEnv,
        config,
      );
    }
    const resourcePlanFingerprints = await runPlanBundleResources(
      normalizedPlugins,
      {
        bundles: bundlePlans.map((plan) => {
          return {
            ...describeBuildScopes([plan.envId], plan.envId, config),
            id: logicalBundlePlanKey(plan),
            entrypoints: plan.entrypoints.map((entrypoint) => {
              const entrypointScope = config.envs[entrypoint.envId];
              return {
                ...entrypoint,
                environmentId: entrypointScope.environmentId,
                targetId: entrypointScope.targetId,
              };
            }),
            envId: plan.envId,
            entryId: plan.entryId,
            modules: plan.modules,
          };
        }),
        modules: fileRecords,
        outputs: config.outputs,
      },
    );
    const physicalPlans = coalescePhysicalBundlePlans(
      bundlePlans,
      devOptions.hmr,
      fileRecords,
      resolvedMapByEnv,
      config,
      resourcePlanFingerprints,
      conditionNames,
    );
    const physicalBundleIdByEntrypoint = new Map(
      physicalPlans.flatMap((physicalPlan) =>
        physicalPlan.entrypoints.map(
          (entrypoint) =>
            [
              `${entrypoint.envId}:${entrypoint.entryId}`,
              physicalPlan.id,
            ] as const,
        ),
      ),
    );
    for (const physicalPlan of physicalPlans) {
      for (const entrypoint of physicalPlan.entrypoints) {
        const moduleIdentity = resolvedMapByEnv
          .get(entrypoint.envId)
          ?.get(entrypoint.entryId)?.moduleIdentity;
        if (moduleIdentity) {
          physicalBundleIdByEntrypoint.set(
            `${entrypoint.envId}:${moduleIdentity}`,
            physicalPlan.id,
          );
        }
      }
    }
    const resolveReference = createReferenceResolver(
      fileRecords,
      staticAssetFileNames,
      pendingFiles,
      config,
    );
    await runGenerateBundleResources(normalizedPlugins, {
      bundles: physicalPlans.map((physicalPlan) => ({
        ...describeBuildScopes(
          physicalPlan.environmentIds,
          physicalPlan.plan.envId,
          config,
        ),
        id: physicalPlan.id,
        entrypoints: physicalPlan.entrypoints.map((entrypoint) => {
          const scope = config.envs[entrypoint.envId];
          return {
            ...entrypoint,
            environmentId: scope.environmentId,
            targetId: scope.targetId,
          };
        }),
        envId: physicalPlan.plan.envId,
        entryId: physicalPlan.plan.entryId,
        modules: physicalPlan.plan.modules,
      })),
      modules: fileRecords,
      outputs: config.outputs,
      resolveReference,
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    const stylesByBundle = collectStylesByBundle(
      physicalPlans,
      pendingFiles,
      resolvedMapByEnv,
    );
    const bundleOutputs = finalizePhysicalBundleOutputs(
      physicalPlans,
      config,
      staticAssetFileNames,
      resolvedMapByEnv,
      stylesByBundle,
      pendingFiles,
      collectResourceFingerprints(physicalPlans, pendingFiles, {
        includeGlobalStyles: !devOptions.hmr,
      }),
      conditionNames,
    );
    bundleMap.clear();
    for (const output of bundleOutputs.values()) {
      const target = {
        fileName: output.fileName,
        exportMode: output.plan.plan.exportMode,
        dependencyFileNames: collectStaticDependencyFileNames(
          output.plan,
          physicalBundleIdByEntrypoint,
          bundleOutputs,
        ),
      };
      for (const entrypoint of output.plan.entrypoints) {
        bundleMap.set(`${entrypoint.envId}:${entrypoint.entryId}`, target);
        const moduleIdentity = resolvedMapByEnv
          .get(entrypoint.envId)
          ?.get(entrypoint.entryId)?.moduleIdentity;
        if (moduleIdentity) {
          bundleMap.set(`${entrypoint.envId}:${moduleIdentity}`, target);
        }
      }
      if (!bundleMap.has(output.plan.plan.entryId)) {
        bundleMap.set(output.plan.plan.entryId, target);
      }
    }
    const documentStyleOutputs = createDocumentStyleOutputs(
      prepared.documents,
      stylesByBundle,
      pendingFiles,
      config,
    );

    const bundles: Array<{
      id: string;
      scopeIds: string[];
      environmentIds: string[];
      targetIds: string[];
      entrypoints: Array<{
        envId: string;
        environmentId: string;
        targetId: string;
        entryId: string;
        entryKind: BundleEntryKind;
        exportMode: "entry" | "dynamic";
      }>;
      environmentId?: string;
      targetId?: string;
      platform?: "node" | "browser";
      envId: string;
      entryId: string;
      fileName: string;
      runtimeHash: string;
      entryKind: BundleEntryKind;
      exportMode: "entry" | "dynamic";
      mapFileName?: string;
      modules: string[];
      conditionNames: string[];
      dependencies: string[];
      staticDependencies: string[];
      dynamicDependencies: string[];
      staticFiles: string[];
      dynamicFiles: string[];
    }> = [];
    for (const physicalPlan of physicalPlans) {
      const plan = physicalPlan.plan;
      const bundleOutput = bundleOutputs.get(physicalPlan.id);
      if (!bundleOutput) {
        throw new Error(
          `Missing finalized bundle output for '${plan.entryId}' in '${plan.envId}'.`,
        );
      }
      const header = [
        emitStaticBundleImports(
          plan.staticImports,
          bundleMap,
          plan.envId,
          bundleOutput.fileName,
          config.envs[plan.envId].platform === "browser" &&
            conditionNames.length > 0
            ? (fileName) =>
                withConditionIdPlaceholder(fileName, conditionOptionSet)
            : undefined,
        ),
        emitAssetReferencePrelude(
          dedupeBundleReferences(plan.parts),
          staticAssetFileNames,
          config.outputs.rootURL,
        ),
        emitOutputReferencePrelude(
          dedupeBundleReferences(plan.parts),
          bundleMap,
          plan.envId,
          bundleOutput.fileName,
          staticAssetFileNames,
          stylesByBundle,
          pendingFiles,
          config.outputs.rootURL,
          config,
          conditionOptionSet,
        ),
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

      outputRegistry.add(
        bundleOutput.fileName,
        patchedBundle,
        `bundle:${physicalPlan.id}`,
      );
      if (mapFileName) {
        outputRegistry.add(
          mapFileName,
          stringifySourceMap(assembled.map),
          `bundle-map:${physicalPlan.id}`,
        );
      }
      const scopes = describeBuildScopes(
        physicalPlan.environmentIds,
        plan.envId,
        config,
      );
      const staticDependencies = Array.from(
        new Set(
          (plan.staticImports ?? [])
            .map((item) =>
              physicalBundleIdByEntrypoint.get(`${plan.envId}:${item.entryId}`),
            )
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const dynamicDependencies = Array.from(
        new Set(
          dedupeBundleReferences(plan.parts)
            .filter(
              (
                reference,
              ): reference is Extract<LinkReference, { kind: "output-url" }> =>
                reference.kind === "output-url" &&
                reference.outputType === "script",
            )
            .map((reference) =>
              physicalBundleIdByEntrypoint.get(
                `${resolveReferenceScopeId(
                  reference,
                  plan.envId,
                  config,
                )}:${reference.outputId}`,
              ),
            )
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const filesForBundleIds = (ids: string[]) =>
        ids.flatMap((id) => {
          const output = bundleOutputs.get(id);
          return output ? [output.fileName] : [];
        });
      bundles.push({
        ...scopes,
        id: physicalPlan.id,
        entrypoints: physicalPlan.entrypoints.map((entrypoint) => {
          const scope = config.envs[entrypoint.envId];
          return {
            ...entrypoint,
            environmentId: scope.environmentId,
            targetId: scope.targetId,
          };
        }),
        envId: plan.envId,
        entryId: plan.entryId,
        fileName: bundleOutput.fileName,
        runtimeHash: contentHash(assembled.code),
        entryKind: plan.entryKind,
        exportMode: plan.exportMode,
        mapFileName,
        modules: plan.modules,
        conditionNames: plan.conditionNames,
        dependencies: staticDependencies,
        staticDependencies,
        dynamicDependencies,
        staticFiles: filesForBundleIds(staticDependencies),
        dynamicFiles: filesForBundleIds(dynamicDependencies),
      });
    }

    const diagnostics = dedupeDiagnostics(
      bundlePlans.flatMap((plan) => plan.diagnostics),
    );
    const bundlesById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
    const bundleFilesById = new Map<string, string[]>();
    const collectBundleFiles = (bundleId: string): string[] => {
      const cached = bundleFilesById.get(bundleId);
      if (cached) return cached;
      const files: string[] = [];
      const visited = new Set<string>();
      const visit = (currentId: string) => {
        if (visited.has(currentId)) return;
        visited.add(currentId);
        const current = bundlesById.get(currentId);
        if (!current) return;
        files.push(current.fileName);
        for (const dependencyId of current.dependencies) {
          visit(dependencyId);
        }
      };
      visit(bundleId);
      bundleFilesById.set(bundleId, files);
      return files;
    };
    const manifest: BundleManifest = {
      bundles: bundles.map((bundle) => ({
        ...bundle,
        type: "script",
        contentType: "text/javascript; charset=utf-8",
        mapFileName: bundle.mapFileName,
      })),
      entrypoints: Object.fromEntries(
        bundles.flatMap((bundle) =>
          bundle.entrypoints.map((entrypoint) => [
            `${entrypoint.envId}:${entrypoint.entryId}`,
            {
              bundleId: bundle.id,
              fileName: bundle.fileName,
              entryId:
                resolvedMapByEnv.get(entrypoint.envId)?.get(entrypoint.entryId)
                  ?.moduleIdentity ??
                portableManifestIdentity(entrypoint.entryId, fileRecords),
              scopeId: entrypoint.envId,
              entryKind: entrypoint.entryKind,
              exportMode: entrypoint.exportMode,
              environmentId: entrypoint.environmentId,
              targetId: entrypoint.targetId,
              bundles: collectBundleFiles(bundle.id),
              staticDependencies: bundle.staticDependencies,
              dynamicDependencies: bundle.dynamicDependencies,
              staticFiles: bundle.staticFiles,
              dynamicFiles: bundle.dynamicFiles,
              styles:
                stylesByBundle.get(
                  `${entrypoint.envId}:${entrypoint.entryId}`,
                ) ?? [],
            },
          ]),
        ),
      ),
      dynamicImports: Object.fromEntries(
        bundles.flatMap((bundle) =>
          bundle.entrypoints.flatMap((entrypoint) =>
            entrypoint.entryKind === "dynamic"
              ? [[`${entrypoint.envId}:${entrypoint.entryId}`, bundle.fileName]]
              : [],
          ),
        ),
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
            environmentId: bundle.environmentId,
            targetId: bundle.targetId,
            scopeIds: bundle.scopeIds,
            environmentIds: bundle.environmentIds,
            targetIds: bundle.targetIds,
            entryId: bundle.entryId,
            bundleKey: bundle.id,
            modules: bundleOutputs.get(bundle.id)?.plan.plan.modules ?? [],
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
                  environmentId: bundle.environmentId,
                  targetId: bundle.targetId,
                  scopeIds: bundle.scopeIds,
                  environmentIds: bundle.environmentIds,
                  targetIds: bundle.targetIds,
                  entryId: bundle.entryId,
                  bundleKey: bundle.id,
                },
              ]
            : [],
        ),
      ],
      metadata: {
        conditions: {
          fileName: "conditions.json",
          global: conditionNames,
          byBundle: Object.fromEntries(
            physicalPlans.flatMap((physicalPlan) => {
              const value = {
                conditionNames: physicalPlan.plan.conditionNames,
                modules: physicalPlan.plan.conditions,
              };
              return [
                [physicalPlan.id, value],
                ...physicalPlan.entrypoints.map((entrypoint) => [
                  `${entrypoint.envId}:${entrypoint.entryId}`,
                  value,
                ]),
              ];
            }),
          ),
        },
        bundleDependencies: Object.fromEntries(
          physicalPlans.map((physicalPlan) => [
            physicalPlan.id,
            physicalPlan.plan.staticImports
              .map((item) =>
                physicalBundleIdByEntrypoint.get(
                  `${physicalPlan.plan.envId}:${item.entryId}`,
                ),
              )
              .filter((id): id is string => Boolean(id)),
          ]),
        ),
      },
    };

    await runBuildEnd(normalizedPlugins, {
      bundles,
      manifest,
      diagnostics,
      modules: fileRecords,
      outputs: config.outputs,
      resolveReference,
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    flushPendingFiles(pendingFiles, manifest, outputRegistry);
    pendingFiles.length = 0;
    await emitDocuments(
      prepared.documents,
      manifest,
      staticAssetFileNames,
      config,
      pendingFiles,
      stylesByBundle,
      documentStyleOutputs,
      outputRegistry,
    );
    flushPendingFiles(pendingFiles, manifest, outputRegistry);
    if (config.outputs.manifestFile) {
      outputRegistry.add(
        config.outputs.manifestFile,
        JSON.stringify(manifest, null, 2),
        "manifest",
      );
    }
    await outputRegistry.flush();

    const hmr = devOptions.hmr
      ? {
          bundles: Object.fromEntries(
            bundlePlans
              .filter((plan) => plan.hmr)
              .map((plan) => [
                `${plan.envId}:${plan.entryId}`,
                plan.hmr as HmrBundleRecord,
              ]),
          ),
          moduleMetadata: createHmrModuleMetadata(fileRecords, config),
        }
      : undefined;

    return {
      conditionNames,
      bundles,
      entrypoints: manifest.entrypoints,
      manifest,
      hmr,
      diagnostics,
    };
  } finally {
    await cleanup();
  }
}

function createHmrModuleMetadata(
  records: FileRecord[],
  config: InternalBundlerConfig,
): NonNullable<HmrBuildState["moduleMetadata"]> {
  return Object.fromEntries(
    records.flatMap((record) => {
      const hash = contentHash(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(record.extraOutputs ?? {})
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([name, output]) => [
                name,
                {
                  outputId: output.outputId,
                  fileName: output.fileName,
                  contentType: output.contentType,
                  type: output.type,
                  template: output.template,
                  metadata: output.metadata,
                },
              ]),
          ),
        ),
      );
      return (record.environmentIds ?? record.envs ?? []).map((scopeId) => {
        const scope = config.envs[scopeId];
        return [
          `${scopeId}:${record.id}`,
          {
            environmentId: scope.environmentId,
            targetId: scope.targetId,
            filePath: record.filePath,
            hash,
          },
        ] as const;
      });
    }),
  );
}

async function prepareDocumentEntries(
  entries: InternalEntrySpec[],
  plugins: NormalizedPlugin[],
  config: InternalBundlerConfig,
  cacheBaseDir: string,
  workerFingerprint: string,
  buildMode: string,
): Promise<{
  entries: InternalEntrySpec[];
  documents: DocumentPlan[];
  assets: StaticAssetOutput[];
}> {
  const scriptEntries: InternalEntrySpec[] = [];
  const documents: DocumentPlan[] = [];
  const assets: StaticAssetOutput[] = [];
  const remote = createRemoteCacheAdapter(
    config.cache?.remote || undefined,
    "documents",
  );

  for (const entry of entries) {
    const isStyle =
      entry.kind === "style" ||
      (entry.kind !== "script" &&
        entry.kind !== "html" &&
        entry.path.toLowerCase().endsWith(".css"));
    if (isStyle) {
      scriptEntries.push({
        ...entry,
        path: path.resolve(entry.path),
        kind: "style",
      });
      continue;
    }
    const isHtml =
      entry.kind === "html" ||
      (entry.kind !== "script" &&
        entry.kind !== "style" &&
        entry.path.toLowerCase().endsWith(".html"));
    if (!isHtml) {
      scriptEntries.push(entry);
      continue;
    }
    const filePath = path.resolve(entry.path);
    const source = await fs.readFile(filePath, "utf8");
    for (const envId of entry.envs ?? Object.keys(config.envs)) {
      const env = config.envs[envId];
      if (!env) {
        throw new Error(`Unknown environment '${envId}' for HTML entry.`);
      }
      const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
      const documentIdentity = packagePathIdentity(
        readPkgSafe(pkgRoot),
        filePath,
      );
      const documentCacheKey = contentHash(
        JSON.stringify({
          format: 3,
          documentIdentity,
          sourceHash: contentHash(source),
          envId,
          target: env.platform,
          workerFingerprint,
          buildMode,
          plugins: plugins.map((plugin) => ({
            name: plugin.name,
            resourceFingerprint: plugin.resourceFingerprint,
            workerFingerprint: plugin.workerFingerprint,
          })),
        }),
      );
      const documentCachePath = path.join(
        cacheBaseDir,
        "documents",
        `${documentCacheKey}.json`,
      );
      let result =
        await readJsonIfExists<DocumentTransformResult>(documentCachePath);
      if (!result && remote) {
        const remoteResult = await remote.get(`${documentCacheKey}.json`);
        if (remoteResult) {
          try {
            result = JSON.parse(remoteResult) as DocumentTransformResult;
            await writeJsonAtomic(documentCachePath, result);
          } catch {
            result = null;
          }
        }
      }
      if (!result) {
        result =
          (await runTransformDocument(plugins, env.environmentId, {
            id: entry.id,
            filePath,
            environmentId: env.environmentId,
            targetId: env.targetId,
            platform: env.platform,
            source,
          })) ?? null;
        if (result) {
          await writeJsonAtomic(documentCachePath, result);
          await remote?.set(`${documentCacheKey}.json`, JSON.stringify(result));
        }
      }
      if (!result) {
        throw new Error(
          `No plugin transformed HTML entry '${filePath}' for '${envId}'.`,
        );
      }
      const outputIds = new Map<string, string>();
      for (const script of result.scripts) {
        if (!script.module) {
          continue;
        }
        const scriptPath = resolveDocumentRequest(filePath, script.id);
        outputIds.set(script.id, scriptPath);
        scriptEntries.push({
          id: script.id,
          path: scriptPath,
          envs: [envId],
          kind: "script",
          source: script.code,
          sourceMap: script.map,
          moduleIdentity:
            script.moduleIdentity ??
            `${documentIdentity}::inline-script:${script.id}`,
          resolveFrom: script.code === undefined ? undefined : filePath,
        });
      }
      for (const style of result.styles) {
        const stylePath = resolveDocumentRequest(filePath, style.id);
        outputIds.set(style.id, stylePath);
        scriptEntries.push({
          id: style.id,
          path: stylePath,
          envs: [envId],
          kind: "style",
          source: style.code,
          moduleIdentity:
            style.moduleIdentity ??
            `${documentIdentity}::inline-style:${style.id}`,
          resolveFrom: style.code === undefined ? undefined : filePath,
        });
      }

      const references = await Promise.all(
        result.references.map(async (reference) => {
          if (
            reference.kind === "output-url" &&
            reference.outputType === "asset" &&
            reference.request
          ) {
            const assetPath = resolveDocumentRequest(
              filePath,
              reference.request.split(/[?#]/, 1)[0],
            );
            const root = findPkgRoot(assetPath) ?? path.dirname(assetPath);
            const assetId = packagePathIdentity(readPkgSafe(root), assetPath);
            const contents = await fs.readFile(assetPath);
            assets.push(
              createStaticAssetOutput(
                assetId,
                path.basename(assetPath),
                contents,
                config,
              ),
            );
            return { ...reference, outputId: assetId };
          }
          if (
            reference.kind === "output-url" ||
            reference.kind === "output-integrity"
          ) {
            return {
              ...reference,
              outputId: outputIds.get(reference.outputId) ?? reference.outputId,
            };
          }
          if (reference.kind === "output-styles") {
            return {
              ...reference,
              outputIds: reference.outputIds.map(
                (outputId) => outputIds.get(outputId) ?? outputId,
              ),
            };
          }
          if (
            reference.kind !== "asset-url" ||
            reference.assetId ||
            !reference.request
          ) {
            return reference;
          }
          const assetPath = resolveDocumentRequest(
            filePath,
            reference.request.split(/[?#]/, 1)[0],
          );
          const root = findPkgRoot(assetPath) ?? path.dirname(assetPath);
          const assetId = packagePathIdentity(readPkgSafe(root), assetPath);
          const contents = await fs.readFile(assetPath);
          assets.push(
            createStaticAssetOutput(
              assetId,
              path.basename(assetPath),
              contents,
              config,
            ),
          );
          return { ...reference, assetId };
        }),
      );
      const referencesById = new Map(
        references.map((reference) => [reference.id, reference]),
      );
      documents.push({
        entryId: entry.id,
        filePath,
        envId,
        outputFileName: entry.outputFileName,
        result: {
          ...result,
          references,
          template: {
            ...result.template,
            references: result.template.references.map(
              (reference) => referencesById.get(reference.id) ?? reference,
            ),
          },
        },
      });
    }
  }

  return {
    entries: dedupeEntries(scriptEntries),
    documents,
    assets: dedupeStaticAssets(assets),
  };
}

function resolveDocumentRequest(htmlFilePath: string, request: string): string {
  if (path.isAbsolute(request)) {
    return path.resolve(request);
  }
  return path.resolve(path.dirname(htmlFilePath), request);
}

function dedupeEntries(entries: InternalEntrySpec[]): InternalEntrySpec[] {
  return Array.from(
    new Map(
      entries.map((entry) => [
        `${path.resolve(entry.path)}\0${(entry.envs ?? []).join(",")}`,
        entry,
      ]),
    ).values(),
  );
}

async function emitDocuments(
  documents: DocumentPlan[],
  manifest: BundleManifest,
  assetFileNames: Map<string, string>,
  config: InternalBundlerConfig,
  pendingFiles: PendingEmitFile[],
  stylesByBundle: Map<string, string[]>,
  documentStyleOutputs: Map<string, string>,
  outputRegistry: OutputRegistry,
): Promise<void> {
  for (const document of documents) {
    const entryName = sanitizeDocumentName(document.entryId, document.filePath);
    const pattern =
      document.outputFileName ??
      document.result.outputFileName ??
      config.outputs.htmlFileName ??
      "[entry].html";
    const fileName = normalizePosixPath(
      pattern.replaceAll("[entry]", entryName),
    );
    const references = new Map(
      document.result.references.map((reference) => [reference.id, reference]),
    );
    const scriptFiles = new Set<string>();
    const styleFiles = new Set<string>();
    const assetFiles = new Set<string>();
    const htmlParts = await Promise.all(
      document.result.template.parts.map(async (part) => {
        if (part.kind === "text") {
          return part.value;
        }
        const reference = references.get(part.referenceId);
        if (!reference) {
          throw new Error(
            `Missing HTML reference '${part.referenceId}' in '${document.filePath}'.`,
          );
        }
        let target: string;
        if (
          reference.kind === "output-url" &&
          reference.outputType === "asset"
        ) {
          const assetFileName = assetFileNames.get(reference.outputId);
          if (!assetFileName) {
            throw new Error(`Missing HTML asset '${reference.outputId}'.`);
          }
          target = assetFileName;
          assetFiles.add(target);
        } else if (reference.kind === "asset-url") {
          const assetFileName = assetFileNames.get(reference.assetId);
          if (!assetFileName) {
            throw new Error(`Missing HTML asset '${reference.assetId}'.`);
          }
          target = assetFileName;
          assetFiles.add(target);
        } else if (reference.kind === "output-styles") {
          const targets = Array.from(
            new Set(
              reference.outputIds.flatMap(
                (outputId) =>
                  stylesByBundle.get(`${document.envId}:${outputId}`) ?? [],
              ),
            ),
          );
          for (const styleFile of targets) styleFiles.add(styleFile);
          return targets
            .map((styleFile) => {
              const url = outputUrlFromDocument(
                styleFile,
                config.outputs.rootURL,
              );
              return `<link rel="stylesheet" href="${encodeTemplateReference(url, "html-attribute")}">\n`;
            })
            .join("");
        } else if (
          reference.kind === "output-url" ||
          reference.kind === "output-integrity"
        ) {
          if (reference.outputType === "script") {
            const entrypoint =
              manifest.entrypoints[`${document.envId}:${reference.outputId}`];
            if (!entrypoint) {
              throw new Error(
                `Missing script output '${reference.outputId}' for HTML entry.`,
              );
            }
            target = entrypoint.fileName;
            scriptFiles.add(target);
          } else {
            const styleKey = `${document.envId}:${reference.outputId}`;
            target =
              documentStyleOutputs.get(styleKey) ??
              manifest.assets?.find(
                (item) => item.type === "style" && item.bundleKey === styleKey,
              )?.fileName ??
              "";
            if (!target) {
              throw new Error(
                `Missing style output '${reference.outputId}' for HTML entry.`,
              );
            }
            styleFiles.add(target);
          }
        } else {
          throw new Error(
            `Module path reference '${reference.id}' is invalid in HTML.`,
          );
        }
        if (reference.kind === "output-integrity") {
          const contents = outputRegistry.contents(target);
          if (!contents) {
            throw new Error(
              `Missing planned output '${target}' while computing integrity for '${document.filePath}'.`,
            );
          }
          return `sha384-${createHash("sha384")
            .update(contents)
            .digest("base64")}`;
        }
        const url = outputUrlFromDocument(target, config.outputs.rootURL);
        return encodeTemplateReference(url, part.encoding);
      }),
    );
    const html = htmlParts.join("");
    pendingFiles.push({
      fileName,
      contents: html,
      envId: document.envId,
      type: "document",
      contentType: "text/html; charset=utf-8",
    });
    manifest.documents ??= [];
    const documentScope = config.envs[document.envId];
    manifest.documents.push({
      envId: document.envId,
      environmentId: documentScope.environmentId,
      targetId: documentScope.targetId,
      entryId: document.entryId,
      fileName,
      scripts: Array.from(scriptFiles),
      styles: Array.from(styleFiles),
      assets: Array.from(assetFiles),
    });
  }
}

function createDocumentStyleOutputs(
  documents: DocumentPlan[],
  stylesByBundle: Map<string, string[]>,
  pendingFiles: PendingEmitFile[],
  config: InternalBundlerConfig,
): Map<string, string> {
  const output = new Map<string, string>();
  const sourceMap = resolveSourceMapOutput(config.outputs.sourceMap);
  for (const document of documents) {
    for (const reference of document.result.references) {
      if (reference.kind !== "output-url" || reference.outputType !== "style") {
        continue;
      }
      const key = `${document.envId}:${reference.outputId}`;
      if (output.has(key)) continue;
      const styleFiles = stylesByBundle.get(key) ?? [];
      if (styleFiles.length === 0) continue;
      if (styleFiles.length === 1) {
        output.set(key, styleFiles[0]);
        continue;
      }
      const pattern =
        config.outputs.cssFileName ??
        "[entry].[target].[environment].[hash].css";
      const scope = config.envs[document.envId];
      const provisional = normalizePosixPath(
        pattern
          .replaceAll("[entry]", sanitizeOutputName(reference.outputId))
          .replaceAll("[environment]", scope.environmentId)
          .replaceAll("[target]", scope.targetId)
          .replaceAll("[hash]", "RESOURCE_HASH"),
      );
      const imports = styleFiles
        .map((styleFile) => {
          const url = joinRootURL(config.outputs.rootURL ?? "/", styleFile);
          return `@import url(${JSON.stringify(url)});`;
        })
        .join("\n");
      const fileName = provisional.replace(
        "RESOURCE_HASH",
        contentHashShort(imports),
      );
      const mapFileName = sourceMap ? `${fileName}.map` : undefined;
      const css =
        sourceMap?.mode === "external" && mapFileName
          ? `${imports}\n/*# sourceMappingURL=${path.basename(mapFileName)} */`
          : imports;
      pendingFiles.push({
        fileName,
        contents: css,
        envId: document.envId,
        type: "style",
        contentType: "text/css; charset=utf-8",
      });
      if (mapFileName) {
        pendingFiles.push({
          fileName: mapFileName,
          contents: JSON.stringify({
            version: 3,
            file: fileName,
            sections: [],
          }),
          envId: document.envId,
          type: "source-map",
          contentType: "application/json; charset=utf-8",
        });
      }
      output.set(key, fileName);
    }
  }
  return output;
}

function outputUrlFromDocument(targetFileName: string, rootURL = "/"): string {
  return joinRootURL(rootURL, targetFileName);
}

function encodeTemplateReference(
  value: string,
  encoding: import("@bundler/shared").ReferenceEncoding,
): string {
  if (encoding === "html-attribute" || encoding === "html-srcset") {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
  return value;
}

function sanitizeDocumentName(entryId: string, filePath: string): string {
  const value = entryId || path.basename(filePath, path.extname(filePath));
  return path
    .basename(value, path.extname(value))
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collectFileReferences(
  fileRecords: FileRecord[],
): Map<string, LinkReference> {
  const references = new Map<string, LinkReference>();
  const ambiguous = new Set<string>();
  const add = (key: string, reference: LinkReference) => {
    const existing = references.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(reference)) {
      throw new Error(`Conflicting link reference '${key}'.`);
    }
    references.set(key, reference);
  };
  for (const fileRecord of fileRecords) {
    const recordReferences = [
      ...(fileRecord.linkReferences ?? []),
      ...Object.values(fileRecord.extraOutputs ?? {}).flatMap(
        (output) => output.template?.references ?? [],
      ),
    ];
    for (const reference of recordReferences) {
      for (const scopeId of fileRecord.environmentIds ??
        fileRecord.envs ??
        []) {
        add(`${scopeId}:${reference.id}`, reference);
      }
      const existing = references.get(reference.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(reference)) {
        references.delete(reference.id);
        ambiguous.add(reference.id);
      } else if (!ambiguous.has(reference.id)) {
        references.set(reference.id, reference);
      }
    }
  }
  return references;
}

function createReferenceResolver(
  fileRecords: FileRecord[],
  assetFileNames: Map<string, string>,
  pendingFiles: PendingEmitFile[],
  config: InternalBundlerConfig,
): (referenceId: string, fromFileName: string, scopeId?: string) => string {
  const references = collectFileReferences(fileRecords);
  return (referenceId, fromFileName, scopeId) => {
    const reference =
      (scopeId ? references.get(`${scopeId}:${referenceId}`) : undefined) ??
      references.get(referenceId);
    if (!reference) {
      throw new Error(`Unknown asset reference '${referenceId}'.`);
    }
    if (reference.kind === "asset-url") {
      const fileName = assetFileNames.get(reference.assetId);
      if (!fileName) {
        throw new Error(`Missing emitted asset '${reference.assetId}'.`);
      }
      return joinRootURL(config.outputs.rootURL ?? "/", fileName);
    }
    if (reference.kind !== "output-url") {
      throw new Error(`Reference '${referenceId}' is not an output URL.`);
    }
    const assetFileName = assetFileNames.get(reference.outputId);
    if (assetFileName) {
      return joinRootURL(config.outputs.rootURL ?? "/", assetFileName);
    }
    const pending = collectPendingLogicalOutputs(pendingFiles).get(
      reference.outputId,
    );
    if (pending) {
      return relativeOutputSpecifier(fromFileName, pending.fileName);
    }
    throw new Error(`Missing emitted output '${reference.outputId}'.`);
  };
}

function collectStylesByBundle(
  physicalPlans: PhysicalBundlePlan[],
  files: PendingEmitFile[],
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
): Map<string, string[]> {
  const globalStyles = files
    .filter((file) => file.type === "style" && file.global)
    .map(finalPendingFileName);
  const direct = new Map<string, string[]>();
  for (const file of files) {
    if (file.type !== "style" || file.global || !file.bundleKey) {
      continue;
    }
    const names = direct.get(file.bundleKey) ?? [];
    names.push(finalPendingFileName(file));
    direct.set(file.bundleKey, names);
  }
  const plans = new Map(
    physicalPlans.map((physicalPlan) => [physicalPlan.id, physicalPlan]),
  );
  const byEntrypoint = new Map(
    physicalPlans.flatMap((physicalPlan) =>
      physicalPlan.entrypoints.map(
        (entrypoint) =>
          [
            `${entrypoint.envId}:${entrypoint.entryId}`,
            physicalPlan.id,
          ] as const,
      ),
    ),
  );
  const output = new Map<string, string[]>();
  const collect = (key: string): string[] => {
    const cached = output.get(key);
    if (cached) return cached;
    const names = [...globalStyles];
    const visited = new Set<string>();
    const visit = (currentKey: string) => {
      if (!currentKey || visited.has(currentKey)) return;
      visited.add(currentKey);
      const plan = plans.get(currentKey)?.plan;
      if (!plan) return;
      for (const dependency of plan.staticImports) {
        visit(byEntrypoint.get(`${plan.envId}:${dependency.entryId}`) ?? "");
      }
      names.push(...(direct.get(currentKey) ?? []));
    };
    visit(key);
    const deduped = Array.from(new Set(names));
    output.set(key, deduped);
    return deduped;
  };
  for (const key of plans.keys()) collect(key);
  for (const physicalPlan of physicalPlans) {
    const names = output.get(physicalPlan.id) ?? [];
    for (const entrypoint of physicalPlan.entrypoints) {
      output.set(`${entrypoint.envId}:${entrypoint.entryId}`, names);
      const moduleIdentity = resolvedMapByEnv
        .get(entrypoint.envId)
        ?.get(entrypoint.entryId)?.moduleIdentity;
      if (moduleIdentity) {
        output.set(`${entrypoint.envId}:${moduleIdentity}`, names);
      }
    }
  }
  return output;
}

function collectResourceFingerprints(
  physicalPlans: PhysicalBundlePlan[],
  files: PendingEmitFile[],
  options: { includeGlobalStyles?: boolean } = {},
): Map<string, string[]> {
  const output = new Map<string, string[]>();
  const globalFingerprints = files
    .filter(
      (file) =>
        file.global &&
        (options.includeGlobalStyles !== false || file.type !== "style"),
    )
    .map(resourceFingerprint)
    .sort();
  for (const physicalPlan of physicalPlans) {
    const fingerprints = files
      .filter((file) => file.bundleKey === physicalPlan.id)
      .map(resourceFingerprint);
    output.set(
      physicalPlan.id,
      Array.from(new Set([...globalFingerprints, ...fingerprints])).sort(),
    );
  }
  return output;
}

function resourceFingerprint(file: PendingEmitFile): string {
  return contentHash(
    JSON.stringify({
      fileName: finalPendingFileName(file),
      contentHash: contentHash(file.contents),
      type: file.type,
      contentType: file.contentType,
      global: file.global === true,
    }),
  );
}

async function prepareCacheRoot(
  cacheBaseDir: string,
  config: InternalBundlerConfig,
  entries: InternalEntrySpec[],
  workerProfile: WorkerTransformProfile,
  plugins: BundlerPlugin[],
  buildMode: string,
): Promise<CacheRootInfo> {
  const v2Dir = path.join(cacheBaseDir, "v2");
  await ensureDir(v2Dir);

  const normalizedConfig = normalizeConfigForCache(
    config,
    entries,
    workerProfile,
    plugins,
    buildMode,
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

  const transformConfig = {
    artifactFormat: 3,
    workerProfile: workerProfile.fingerprint,
    buildMode,
    environmentVariables: config.environmentVariables ?? {},
    transforms: serializeConfigValue(config.transforms),
    imports: serializeConfigValue(config.imports),
    css: config.css,
  };
  const transformHash = contentHash(JSON.stringify(transformConfig));
  const transformRoot = path.join(cacheBaseDir, "transform-v3", transformHash);
  await ensureDir(transformRoot);

  return {
    activeRoot,
    configHash,
    transformRoot,
    transformHash,
    remote: config.cache?.remote || undefined,
  };
}

function normalizeConfigForCache(
  config: InternalBundlerConfig,
  entries: InternalEntrySpec[],
  workerProfile: WorkerTransformProfile,
  plugins: BundlerPlugin[],
  buildMode: string,
): unknown {
  return {
    environments: Object.keys(config.environments).sort(),
    targets: Object.fromEntries(
      Object.entries(config.targets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([targetId, target]) => [
          targetId,
          {
            platform: target.platform,
            chunking: target.chunking,
            packageResolver: serializeConfigValue(target.packageResolver),
            defines: serializeConfigValue(target.defines ?? {}),
          },
        ]),
    ),
    entries: entries.map((entry) => ({
      path: portableCachePathIdentity(entry.path),
      environment: entry.environment,
      targets: [...(entry.targets ?? [])],
    })),
    outputs: {
      outDir: portableCachePathIdentity(config.outputs.outDir),
      sourceMap: config.outputs.sourceMap,
    },
    workerProfile: workerProfile.fingerprint,
    plugins: serializeConfigValue(plugins),
    configFile: config.configFile
      ? portableCachePathIdentity(config.configFile)
      : undefined,
    resolverAliases: collectResolverAliasCacheIdentity(config, entries).map(
      (identity) => ({
        ...identity,
        filePath: portableCachePathIdentity(identity.filePath),
      }),
    ),
    packageResolvers: collectPackageResolverCacheIdentity(config).map(
      (identity) => ({
        ...identity,
        modulePath: portableCachePathIdentity(identity.modulePath),
      }),
    ),
    buildMode,
    environmentVariables: serializeConfigValue(
      config.environmentVariables ?? {},
    ),
    transforms: serializeConfigValue(config.transforms),
    imports: serializeConfigValue(config.imports),
    css: config.css,
    dev: config.dev,
  };
}

function serializeConfigValue(value: unknown): unknown {
  if (typeof value === "string" && path.isAbsolute(value)) {
    return portableCachePathIdentity(value);
  }
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

function portableCachePathIdentity(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  const pkgRoot = findPkgRoot(absolutePath);
  if (!pkgRoot) {
    return `unpackaged::${path.basename(absolutePath) || "."}`;
  }
  return packagePathIdentity(readPkgSafe(pkgRoot), absolutePath);
}

function resolveSourceMapOutput(
  sourceMap: InternalBundlerConfig["outputs"]["sourceMap"],
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

function collectEntries(entries: InternalEntrySpec[]): InternalEntrySpec[] {
  return entries.map((entry) => ({ ...entry, id: entry.path }));
}

function inferEntryModuleType(
  entry: InternalEntrySpec,
  filePath: string,
): ModuleResolution["type"] {
  if (entry.kind === "style" || filePath.toLowerCase().endsWith(".css")) {
    return "css";
  }
  if (entry.kind === "script" || entry.source != null) {
    return "javascript";
  }
  return inferModuleTypeFromPath(filePath);
}

function inferModuleTypeFromPath(filePath: string): ModuleResolution["type"] {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (/\.(?:[cm]?js|jsx|tsx?|mts|cts|json)$/.test(lower)) return "javascript";
  return "asset";
}

function resolveJsLikeSyntax(
  config: InternalBundlerConfig,
  filePath: string,
  type: ModuleResolution["type"],
): { jsx: boolean; ts: boolean } {
  if (type !== "javascript") return { jsx: false, ts: false };
  const extension = path.extname(filePath).toLowerCase();
  const defaults: Record<string, { jsx?: boolean; typescript?: boolean }> = {
    ".js": {},
    ".mjs": {},
    ".cjs": {},
    ".jsx": { jsx: true },
    ".ts": { typescript: true },
    ".tsx": { jsx: true, typescript: true },
    ".json": {},
  };
  const syntax = config.transforms?.jsLike?.[extension] ?? defaults[extension];
  if (!syntax) {
    throw new Error(
      `No JS-like syntax configuration exists for '${extension || filePath}'.`,
    );
  }
  return { jsx: syntax.jsx === true, ts: syntax.typescript === true };
}

function resolvedTransformConfig(
  config: InternalBundlerConfig,
): Record<string, unknown> {
  const defaults: Record<string, { jsx?: boolean; typescript?: boolean }> = {
    ".js": {},
    ".mjs": {},
    ".cjs": {},
    ".jsx": { jsx: true },
    ".ts": { typescript: true },
    ".tsx": { jsx: true, typescript: true },
    ".json": {},
  };
  const jsLike = {
    ...defaults,
    ...(config.transforms?.jsLike ?? {}),
  };
  return {
    css:
      config.css === false ? false : (config.transforms?.css ?? "lightningcss"),
    jsLike: Object.fromEntries(
      Object.entries(jsLike).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}

function validateTransformConfig(config: InternalBundlerConfig): void {
  const transforms = config.transforms;
  if (!transforms) return;
  const unknownTransformKeys = Object.keys(transforms).filter(
    (key) => key !== "css" && key !== "jsLike",
  );
  if (unknownTransformKeys.length > 0) {
    throw new Error(
      `Unsupported transform configuration '${unknownTransformKeys[0]}'.`,
    );
  }
  if (
    transforms.css !== undefined &&
    transforms.css !== false &&
    transforms.css !== "lightningcss"
  ) {
    throw new Error(
      "transforms.css must be exactly 'lightningcss' or false; arbitrary Lightning CSS options are not accepted.",
    );
  }
  for (const [extension, syntax] of Object.entries(transforms.jsLike ?? {})) {
    if (!extension.startsWith(".")) {
      throw new Error(`JS-like extension '${extension}' must start with '.'.`);
    }
    if (!syntax || typeof syntax !== "object" || Array.isArray(syntax)) {
      throw new Error(`JS-like extension '${extension}' requires an object.`);
    }
    const unknownSyntaxKeys = Object.keys(syntax).filter(
      (key) => key !== "jsx" && key !== "typescript",
    );
    if (unknownSyntaxKeys.length > 0) {
      throw new Error(
        `Unsupported JS-like transform option '${unknownSyntaxKeys[0]}' for '${extension}'.`,
      );
    }
    if (
      (syntax.jsx !== undefined && typeof syntax.jsx !== "boolean") ||
      (syntax.typescript !== undefined &&
        typeof syntax.typescript !== "boolean")
    ) {
      throw new Error(
        `JS-like syntax flags for '${extension}' must be booleans.`,
      );
    }
  }
}

function resolveBuildMode(): string {
  return process.env.BUNDLER_MODE ?? process.env.NODE_ENV ?? "development";
}

function pickEntriesForEnv(
  entries: InternalEntrySpec[],
  envId: string,
  target: "node" | "browser" | undefined,
): InternalEntrySpec[] {
  return entries.filter(
    (entry) =>
      (!entry.envs || entry.envs.includes(envId)) &&
      entryPathSupportsTarget(entry.path, target),
  );
}

function entryPathSupportsTarget(
  filePath: string,
  target: "node" | "browser" | undefined,
): boolean {
  if (!target) {
    return true;
  }
  const portablePath = filePath.replaceAll("\\", "/");
  if (/\.(?:client|browser)\.[^./]+$/i.test(portablePath)) {
    return target === "browser";
  }
  if (/\.(?:server|node)\.[^./]+$/i.test(portablePath)) {
    return target === "node";
  }
  return true;
}

function createBuiltinPlugins(config: InternalBundlerConfig): BundlerPlugin[] {
  const plugins: BundlerPlugin[] = [
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/html-plugin"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/json-plugin"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/typescript-plugin"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/dynamic-imports/bundler"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/query-imports/bundler"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/import-attributes/bundler"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/asset-imports/bundler"),
      options: {
        imageRepresentation:
          config.imports?.bareImages === undefined
            ? "image-reference-with-size"
            : config.imports.bareImages,
        assetRepresentation:
          config.imports?.bareAssets === undefined
            ? "url"
            : config.imports.bareAssets,
      },
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/wasm-plugin"),
    },
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/module-paths/bundler"),
    },
  ];
  const cssTransformer =
    config.css === false ? false : (config.transforms?.css ?? "lightningcss");
  if (cssTransformer !== false) {
    const sourceMaps = resolveSourceMapOutput(config.outputs.sourceMap);
    plugins.push({
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/css-plugin"),
      options: {
        sourceMaps: Boolean(sourceMaps),
        sourcesContent: sourceMaps?.sourcesContent ?? false,
      },
    });
  }

  return plugins;
}

function createRepresentationFallbackPlugins(): BundlerPlugin[] {
  return [
    {
      __bundlerPluginRef: true,
      module: resolveBundlerDependency("@bundler/static-assets/bundler"),
    },
  ];
}

function resolveBundlerDependency(specifier: string): string {
  try {
    return requireFromBundler.resolve(specifier);
  } catch (error) {
    throw new Error(
      `Bundler runtime dependency '${specifier}' is unavailable. Run the package build before loading the bundler.`,
      { cause: error },
    );
  }
}

function createCrossEnvironmentOwnerMaps(
  graphs: ModuleGraph[],
  entriesByEnv: Map<string, BundleEntry[]>,
  plugins: NormalizedPlugin[],
  config: InternalBundlerConfig,
): Map<string, Map<string, string>> {
  type Occurrence = {
    graph: ModuleGraph;
    moduleId: string;
    node: ModuleNode;
    consumers: Set<string>;
    consumerNodes: Map<string, string>;
  };
  const occurrencesByModule = new Map<string, Occurrence[]>();
  for (const graph of graphs) {
    const consumersByModule = new Map<string, Set<string>>();
    const entryNodes = new Map<string, string>();
    for (const entry of entriesByEnv.get(graph.envId) ?? []) {
      const entryNodeId = entry.entryNodeId ?? entry.entryId;
      entryNodes.set(entry.entryId, entryNodeId);
      const selection = collectBundleSelection(graph, entryNodeId);
      for (const moduleId of selection.keys()) {
        const consumers = consumersByModule.get(moduleId) ?? new Set<string>();
        consumers.add(entry.entryId);
        consumersByModule.set(moduleId, consumers);
      }
    }
    for (const [moduleId, consumers] of consumersByModule) {
      const node = graph.nodes.get(moduleId);
      if (!node) continue;
      const occurrences = occurrencesByModule.get(moduleId) ?? [];
      occurrences.push({
        graph,
        moduleId,
        node,
        consumers,
        consumerNodes: new Map(
          Array.from(consumers, (consumer) => [
            consumer,
            entryNodes.get(consumer) ?? consumer,
          ]),
        ),
      });
      occurrencesByModule.set(moduleId, occurrences);
    }
  }

  const infoById = new Map<
    string,
    {
      id: string;
      moduleIdentity?: string;
      filePath: string;
      environmentIds: string[];
      entryConsumers: string[];
    }
  >();
  for (const occurrences of occurrencesByModule.values()) {
    const first = occurrences[0];
    const environmentIds = Array.from(
      new Set(occurrences.map((item) => item.graph.envId)),
    ).sort();
    const entryConsumers = Array.from(
      new Set(occurrences.flatMap((item) => Array.from(item.consumers))),
    ).sort();
    infoById.set(first.moduleId, {
      id: first.moduleId,
      moduleIdentity: first.node.irHeader.moduleIdentity,
      filePath: first.node.filePath,
      environmentIds,
      entryConsumers,
    });
  }

  const ownersByEnv = new Map<string, Map<string, string>>();
  const manualOwnerScopes = new Map<
    string,
    { environmentIds: string[]; moduleId: string }
  >();
  for (const graph of graphs) {
    ownersByEnv.set(graph.envId, new Map());
  }
  for (const occurrences of occurrencesByModule.values()) {
    const first = occurrences[0];
    const consumers = Array.from(
      new Set(occurrences.flatMap((item) => Array.from(item.consumers))),
    ).sort();
    const moduleInfo = {
      id: first.moduleId,
      moduleIdentity: first.node.irHeader.moduleIdentity,
      filePath: first.node.filePath,
      environmentIds: Array.from(
        new Set(occurrences.map((item) => item.graph.envId)),
      ).sort(),
      entryConsumers: consumers,
    };
    let manualOwner: string | undefined;
    for (const plugin of plugins) {
      const label = plugin.manualChunk?.(moduleInfo, {
        getModuleInfo: (id) => infoById.get(id),
      });
      if (label !== undefined) {
        if (!label || /[\0\r\n]/.test(label)) {
          throw new Error(
            `Plugin '${plugin.name}' returned an invalid manual chunk label for '${first.moduleId}'.`,
          );
        }
        manualOwner = `bundler:manual:${sanitizeOutputName(plugin.name)}:${sanitizeOutputName(label)}`;
        const existingScope = manualOwnerScopes.get(manualOwner);
        if (
          existingScope &&
          !sameStringSet(
            existingScope.environmentIds,
            moduleInfo.environmentIds,
          )
        ) {
          throw new Error(
            `Plugin '${plugin.name}' grouped incompatible module variants in manual chunk '${label}': ` +
              `'${existingScope.moduleId}' is available in [${existingScope.environmentIds.join(", ")}], ` +
              `but '${first.moduleId}' is available in [${moduleInfo.environmentIds.join(", ")}].`,
          );
        }
        manualOwnerScopes.set(manualOwner, {
          environmentIds: moduleInfo.environmentIds,
          moduleId: first.moduleId,
        });
        break;
      }
    }
    for (const occurrence of occurrences) {
      const localConsumers = Array.from(occurrence.consumers).sort();
      const splitThisScope =
        config.envs[occurrence.graph.envId].chunking === "split";
      const rootOwner = localConsumers.find(
        (consumer) =>
          occurrence.consumerNodes.get(consumer) === occurrence.moduleId,
      );
      const owner = rootOwner
        ? rootOwner
        : (manualOwner ??
          (splitThisScope && localConsumers.length > 1
            ? createSharedBundleEntryId(
                new Set(
                  localConsumers.map((consumer) =>
                    portableGraphModuleIdentity(
                      occurrence.graph,
                      occurrence.consumerNodes.get(consumer) ?? consumer,
                    ),
                  ),
                ),
              )
            : localConsumers.length > 1
              ? "bundler:shared:single"
              : localConsumers[0]));
      if (owner) {
        ownersByEnv
          .get(occurrence.graph.envId)
          ?.set(occurrence.moduleId, owner);
      }
    }
  }
  splitEvaluationIncompatibleOwners(ownersByEnv, graphs, entriesByEnv);
  return ownersByEnv;
}

function splitEvaluationIncompatibleOwners(
  ownersByEnv: Map<string, Map<string, string>>,
  graphs: ModuleGraph[],
  entriesByEnv: Map<string, BundleEntry[]>,
): void {
  type OrderedModule = {
    moduleId: string;
    portableId: string;
    portableConsumers: Set<string>;
    orderByConsumer: Map<string, number>;
  };
  const modulesByOwner = new Map<string, Map<string, OrderedModule>>();

  for (const graph of graphs) {
    const owners = ownersByEnv.get(graph.envId);
    if (!owners) continue;
    for (const entry of entriesByEnv.get(graph.envId) ?? []) {
      const entryNodeId = entry.entryNodeId ?? entry.entryId;
      const selection = collectBundleSelection(graph, entryNodeId);
      const ordered = orderSelectedFiles(graph, selection);
      const portableConsumer = portableGraphModuleIdentity(graph, entryNodeId);
      const consumerId = `${graph.envId}\0${portableConsumer}`;
      for (const [index, node] of ordered.entries()) {
        const owner = owners.get(node.id);
        if (
          !owner ||
          (!owner.startsWith("bundler:shared:") &&
            !owner.startsWith("bundler:manual:"))
        ) {
          continue;
        }
        const modules = modulesByOwner.get(owner) ?? new Map();
        const module = modules.get(node.id) ?? {
          moduleId: node.id,
          portableId: portableGraphModuleIdentity(graph, node.id),
          portableConsumers: new Set<string>(),
          orderByConsumer: new Map<string, number>(),
        };
        module.portableConsumers.add(portableConsumer);
        module.orderByConsumer.set(consumerId, index);
        modules.set(node.id, module);
        modulesByOwner.set(owner, modules);
      }
    }
  }

  let reassignedSingleOwner = false;
  for (const [owner, modulesMap] of modulesByOwner) {
    const modules = Array.from(modulesMap.values()).sort((left, right) =>
      left.portableId.localeCompare(right.portableId),
    );
    if (owner.startsWith("bundler:manual:")) {
      if (!hasAcyclicEvaluationOrder(modules)) {
        throw new Error(
          `Manual chunk '${owner}' has incompatible evaluation order across entrypoints.`,
        );
      }
      continue;
    }

    const compatibleGroups: OrderedModule[][] = [];
    for (const module of modules) {
      const group = compatibleGroups.find((candidate) =>
        hasAcyclicEvaluationOrder([...candidate, module]),
      );
      if (group) {
        group.push(module);
      } else {
        compatibleGroups.push([module]);
      }
    }
    if (compatibleGroups.length <= 1) continue;

    if (owner === "bundler:shared:single") {
      for (const module of modules) {
        const splitOwner = createSharedBundleEntryId(module.portableConsumers);
        for (const owners of ownersByEnv.values()) {
          if (owners.get(module.moduleId) === owner) {
            owners.set(module.moduleId, splitOwner);
          }
        }
      }
      reassignedSingleOwner = true;
      continue;
    }

    for (const group of compatibleGroups) {
      const splitOwner = `${owner}:${contentHashShort(
        group
          .map((module) => module.portableId)
          .sort()
          .join("\0"),
        10,
      )}`;
      const moduleIds = new Set(group.map((module) => module.moduleId));
      for (const owners of ownersByEnv.values()) {
        for (const moduleId of moduleIds) {
          if (owners.get(moduleId) === owner) {
            owners.set(moduleId, splitOwner);
          }
        }
      }
    }
  }
  if (reassignedSingleOwner) {
    splitEvaluationIncompatibleOwners(ownersByEnv, graphs, entriesByEnv);
  }
}

function hasAcyclicEvaluationOrder(
  modules: Array<{ orderByConsumer: Map<string, number> }>,
): boolean {
  const edges = new Map(
    modules.map((module) => [module, new Set<(typeof modules)[number]>()]),
  );
  const consumers = new Set(
    modules.flatMap((module) => Array.from(module.orderByConsumer.keys())),
  );
  for (const consumer of consumers) {
    const ordered = modules
      .flatMap((module) => {
        const order = module.orderByConsumer.get(consumer);
        return order === undefined ? [] : [{ module, order }];
      })
      .sort((left, right) => left.order - right.order);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index - 1].order !== ordered[index].order) {
        edges.get(ordered[index - 1].module)?.add(ordered[index].module);
      }
    }
  }

  const active = new Set<(typeof modules)[number]>();
  const visited = new Set<(typeof modules)[number]>();
  const visit = (module: (typeof modules)[number]): boolean => {
    if (active.has(module)) return false;
    if (visited.has(module)) return true;
    active.add(module);
    for (const dependency of edges.get(module) ?? []) {
      if (!visit(dependency)) return false;
    }
    active.delete(module);
    visited.add(module);
    return true;
  };
  return modules.every(visit);
}

function createBundlePartitions(
  graph: ModuleGraph,
  rawEntries: BundleEntry[],
  globalOwners?: Map<string, string>,
): BundlePartition[] {
  const entries = Array.from(
    new Map(rawEntries.map((entry) => [entry.entryId, entry])).values(),
  );
  const entryIds = new Set(entries.map((entry) => entry.entryId));
  const entryOwnersByNode = new Map(
    entries.map((entry) => [entry.entryNodeId ?? entry.entryId, entry.entryId]),
  );
  const sharedEntryIds = new Set<string>();

  const entryData = entries.map((entry) => {
    const entryNodeId = entry.entryNodeId ?? entry.entryId;
    if (!graph.nodes.has(entryNodeId)) {
      throw new Error(`Entry not found in graph: ${entryNodeId}`);
    }
    const resolution = resolveEntryConditions(graph, entryNodeId);
    return {
      ...entry,
      entryNodeId,
      selection: collectBundleSelection(graph, entryNodeId),
      conditions: resolution.conditions,
      diagnostics: resolution.diagnostics,
    };
  });

  const consumersByModule = new Map<string, Set<string>>();
  const combinedSelection = new Map<string, Set<string>>();
  for (const entry of entryData) {
    for (const [moduleId, cells] of entry.selection) {
      const consumers = consumersByModule.get(moduleId) ?? new Set<string>();
      consumers.add(entry.entryId);
      consumersByModule.set(moduleId, consumers);
      const combinedCells =
        combinedSelection.get(moduleId) ?? new Set<string>();
      for (const cellId of cells) {
        combinedCells.add(cellId);
      }
      combinedSelection.set(moduleId, combinedCells);
    }
  }

  const ownerByModule = new Map<string, string>();
  for (const [moduleId, consumers] of consumersByModule) {
    const globalOwner = globalOwners?.get(moduleId);
    if (globalOwner) {
      ownerByModule.set(moduleId, globalOwner);
      if (
        globalOwner.startsWith("bundler:shared:") ||
        globalOwner.startsWith("bundler:manual:")
      ) {
        if (entryIds.has(globalOwner)) {
          throw new Error(
            `Reserved bundle entry id '${globalOwner}' is in use.`,
          );
        }
        sharedEntryIds.add(globalOwner);
      }
    } else if (entryOwnersByNode.has(moduleId)) {
      ownerByModule.set(moduleId, entryOwnersByNode.get(moduleId) as string);
    } else if (consumers.size > 1) {
      const sharedEntryId = createSharedBundleEntryId(
        new Set(
          Array.from(consumers, (consumer) =>
            portableGraphModuleIdentity(graph, consumer),
          ),
        ),
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

  // A shared chunk cannot depend on a non-root module that remains owned by an
  // entry chunk: the entry already imports the shared chunk, so that ownership
  // would create a shared -> entry -> shared initialization cycle. Pull those
  // dependencies into the shared family until its module graph is closed.
  // Explicit and dynamic entries remain hard roots even when imported.
  let ownershipChanged = true;
  while (ownershipChanged) {
    ownershipChanged = false;
    for (const [moduleId] of combinedSelection) {
      const owner = ownerByModule.get(moduleId);
      if (
        !owner ||
        (!owner.startsWith("bundler:shared:") &&
          !owner.startsWith("bundler:manual:"))
      ) {
        continue;
      }
      const node = graph.nodes.get(moduleId);
      if (!node) {
        continue;
      }
      for (const dependencyId of collectSelectedFileDeps(
        node,
        combinedSelection,
      )) {
        const dependencyOwner = ownerByModule.get(dependencyId);
        if (
          dependencyOwner &&
          dependencyOwner !== owner &&
          entryIds.has(dependencyOwner) &&
          !entryOwnersByNode.has(dependencyId)
        ) {
          ownerByModule.set(dependencyId, owner);
          ownershipChanged = true;
        }
      }
    }
  }

  const selectionsByOwner = new Map<string, Map<string, Set<string>>>();
  const conditionStatesByOwner = new Map<
    string,
    Map<string, { unconditional: boolean; conditional: ConditionExpr[] }>
  >();
  for (const entry of entryData) {
    for (const [moduleId, cells] of entry.selection) {
      const owner = ownerByModule.get(moduleId);
      if (!owner) {
        continue;
      }
      mergeSelectedCells(selectionsByOwner, owner, moduleId, cells);

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
    ...entries,
    ...Array.from(sharedEntryIds)
      .sort()
      .map((entryId) => ({
        entryId,
        entryKind: entryId.startsWith("bundler:manual:")
          ? ("manual" as const)
          : ("shared" as const),
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

function createSharedBundleEntryId(consumers: Set<string>): string {
  return `bundler:shared:${contentHashShort(
    Array.from(consumers).sort().join("\0"),
    10,
  )}`;
}

function portableGraphModuleIdentity(
  graph: ModuleGraph,
  moduleId: string,
): string {
  return (
    graph.nodes.get(moduleId)?.irHeader.moduleIdentity ??
    portableHashIdentity(moduleId)
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
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
  hmrTarget: boolean,
): Promise<BundlePlanDraftWithHmr> {
  const { entryId, entryKind, exportMode, conditions, diagnostics, selection } =
    partition;
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
  const namespaceDemanded = new Set(partition.namespaceDemanded);
  if (entryKind === "dynamic" && entryNode) {
    namespaceDemanded.add(entryNode.id);
  }
  const emittedNamespaces = new Set<string>();
  const hmrCells: HmrCellRecord[] = [];
  const hmrSymbols = new Set<string>();
  const useHmr = devOptions.hmr && hmrTarget;
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
    parts.push({
      code: emitHmrBundleRegistration(`${graph.envId}:${entryId}`),
    });
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
              useReactRefresh
                ? collectReactRefreshSymbols(node, new Set([cell.id]))
                : [],
            );
            hmrCells.push(hmrCell.record);
            return {
              code: hmrCell.code,
              map: hmrCell.map,
              sourceContents: node.irHeader.sourceContents,
              references: cell.linkReferences,
            };
          }),
        )
      : await Promise.all(
          orderedCells.map((cell) =>
            readCellPart(cell, node.irHeader.sourceContents),
          ),
        );
    parts.push(...cellParts.filter((part) => part.code.length > 0));

    if (namespaceDemanded.has(node.id)) {
      parts.push({ code: emitNamespaceObject(node) });
      emittedNamespaces.add(node.id);
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
  }
  if (
    entryKind === "dynamic" &&
    entryNode &&
    !emittedNamespaces.has(entryNode.id)
  ) {
    parts.push({ code: emitNamespaceObject(entryNode) });
  }
  const exportFooter = emitBundleExports(
    entryNode,
    entryKind,
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
    entryKind,
    exportMode,
    modules: orderedFiles.map((node) => node.id),
    conditions: conditionRecords,
    conditionNames,
    orderedParts: parts,
    staticImports: partition.staticImports,
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
  config: InternalBundlerConfig,
  devOptions: ResolvedDevOptions,
): BundlePlanDraftWithHmr {
  const browser = config.envs[envId]?.platform === "browser";
  return {
    envId,
    entryId,
    entryKind: "shared",
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
    diagnostics: [],
  };
}

function portableHashIdentity(id: string): string {
  return path.isAbsolute(id) ? normalizePosixPath(path.basename(id)) : id;
}

function portableManifestIdentity(
  id: string,
  fileRecords: FileRecord[],
): string {
  const record = fileRecords.find(
    (candidate) =>
      candidate.id === id ||
      candidate.filePath === id ||
      candidate.moduleIdentity === id,
  );
  return record?.moduleIdentity ?? portableHashIdentity(id);
}

function portableBundleParts(
  parts: BundlePart[],
  portableIdentity: (id: string) => string,
): Array<Omit<BundlePart, "references"> & { references?: unknown[] }> {
  return parts.map((part) => ({
    ...part,
    references: part.references?.map((reference) =>
      portableLinkReference(reference, portableIdentity),
    ),
  }));
}

function portableLinkReference(
  reference: LinkReference,
  portableIdentity: (id: string) => string,
): unknown {
  switch (reference.kind) {
    case "module-url":
    case "module-filename":
    case "module-dirname":
      return {
        kind: reference.kind,
        symbol: reference.symbol,
        ownerId: portableIdentity(reference.ownerId),
      };
    case "asset-url":
      return {
        kind: reference.kind,
        symbol: reference.symbol,
        assetId: portableIdentity(reference.assetId),
        ownerId: reference.ownerId
          ? portableIdentity(reference.ownerId)
          : undefined,
        request: reference.request,
        usage: reference.usage,
      };
    case "output-url":
      return {
        kind: reference.kind,
        outputId: portableIdentity(reference.outputId),
        outputType: reference.outputType,
        symbol: reference.symbol,
        ownerId: reference.ownerId
          ? portableIdentity(reference.ownerId)
          : undefined,
        request: reference.request,
        usage: reference.usage,
        includeDependencies: reference.includeDependencies,
        urlMode: reference.urlMode,
        // Script selectors are represented by the resolved dependency class in
        // createPlanLinkDescriptor. Keeping the literal target name here would
        // prevent equivalent target graphs from sharing physical output.
        environment:
          reference.outputType === "script" ? undefined : reference.environment,
        targetId:
          reference.outputType === "script" ? undefined : reference.targetId,
      };
    case "output-integrity":
      return {
        kind: reference.kind,
        outputId: portableIdentity(reference.outputId),
        outputType: reference.outputType,
        ownerId: reference.ownerId
          ? portableIdentity(reference.ownerId)
          : undefined,
      };
    case "output-styles":
      return {
        kind: reference.kind,
        outputIds: reference.outputIds.map(portableIdentity),
        ownerId: reference.ownerId
          ? portableIdentity(reference.ownerId)
          : undefined,
      };
  }
}

function groupCrossScopeDynamicBundlePlans(
  plans: BundlePlan[],
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
  config: InternalBundlerConfig,
): BundlePlan[] {
  const planByEntrypoint = new Map<string, BundlePlan>();
  const registerEntrypoint = (
    plan: BundlePlan,
    envId: string,
    entryId: string,
  ) => {
    planByEntrypoint.set(`${envId}:${entryId}`, plan);
    const moduleIdentity = resolvedMapByEnv
      .get(envId)
      ?.get(entryId)?.moduleIdentity;
    if (moduleIdentity) {
      planByEntrypoint.set(`${envId}:${moduleIdentity}`, plan);
    }
  };
  for (const plan of plans) {
    for (const entrypoint of plan.entrypoints) {
      registerEntrypoint(plan, entrypoint.envId, entrypoint.entryId);
    }
  }

  const consumersByPlan = new Map<BundlePlan, Set<string>>();
  const portableEntrypoint = (plan: BundlePlan): string => {
    const entrypoint = plan.entrypoints[0];
    const moduleIdentity = resolvedMapByEnv
      .get(entrypoint.envId)
      ?.get(entrypoint.entryId)?.moduleIdentity;
    return moduleIdentity ?? portableHashIdentity(entrypoint.entryId);
  };
  for (const consumer of plans) {
    for (const reference of dedupeBundleReferences(consumer.parts)) {
      if (
        reference.kind !== "output-url" ||
        reference.outputType !== "script"
      ) {
        continue;
      }
      const targetScopeId = resolveReferenceScopeId(
        reference,
        consumer.envId,
        config,
      );
      if (targetScopeId === consumer.envId) {
        continue;
      }
      const target = planByEntrypoint.get(
        `${targetScopeId}:${reference.outputId}`,
      );
      if (!target || target.entryKind !== "dynamic") {
        continue;
      }
      const consumers = consumersByPlan.get(target) ?? new Set<string>();
      consumers.add(portableEntrypoint(consumer));
      consumersByPlan.set(target, consumers);
    }
  }

  const groups = new Map<string, BundlePlan[]>();
  for (const plan of plans) {
    const consumers = consumersByPlan.get(plan);
    if (!consumers || consumers.size === 0) {
      continue;
    }
    const key = `${plan.envId}\0${Array.from(consumers).sort().join("\0")}`;
    const group = groups.get(key) ?? [];
    group.push(plan);
    groups.set(key, group);
  }

  const groupedPlans = new Set<BundlePlan>();
  const mergedPlans: BundlePlan[] = [];
  for (const candidates of groups.values()) {
    if (candidates.length < 2) {
      continue;
    }
    const ordered = orderMergedBundlePlans(candidates, resolvedMapByEnv);
    const candidateSet = new Set(candidates);
    const hasIntraGroupDynamicEdge = candidates.some((plan) =>
      dedupeBundleReferences(plan.parts).some((reference) => {
        if (
          reference.kind !== "output-url" ||
          reference.outputType !== "script"
        ) {
          return false;
        }
        const target = planByEntrypoint.get(
          `${resolveReferenceScopeId(reference, plan.envId, config)}:${reference.outputId}`,
        );
        return target !== undefined && candidateSet.has(target);
      }),
    );
    if (hasIntraGroupDynamicEdge) {
      continue;
    }
    const staticImports = new Map<string, Set<string>>();
    for (const plan of ordered) {
      groupedPlans.add(plan);
      for (const item of plan.staticImports) {
        const dependency = planByEntrypoint.get(
          `${plan.envId}:${item.entryId}`,
        );
        if (dependency && candidateSet.has(dependency)) {
          continue;
        }
        const symbols = staticImports.get(item.entryId) ?? new Set<string>();
        for (const symbol of item.symbols) {
          symbols.add(symbol);
        }
        staticImports.set(item.entryId, symbols);
      }
    }
    const entrypoints = ordered
      .flatMap((plan) => plan.entrypoints)
      .sort((left, right) =>
        `${left.envId}:${left.entryId}`.localeCompare(
          `${right.envId}:${right.entryId}`,
        ),
      );
    const entryIdentity = entrypoints
      .map((entrypoint) => {
        const moduleIdentity = resolvedMapByEnv
          .get(entrypoint.envId)
          ?.get(entrypoint.entryId)?.moduleIdentity;
        return moduleIdentity ?? portableHashIdentity(entrypoint.entryId);
      })
      .join("\0");
    const consumerIdentity = Array.from(consumersByPlan.get(ordered[0]) ?? [])
      .sort()
      .join("\0");
    mergedPlans.push({
      envId: ordered[0].envId,
      entryId: `bundler:dynamic-group:${contentHashShort(
        `${consumerIdentity}\0${entryIdentity}`,
        12,
      )}`,
      entryKind: "dynamic",
      exportMode: "dynamic",
      entrypoints,
      parts: ordered.flatMap((plan) => plan.parts),
      staticImports: Array.from(staticImports, ([entryId, symbols]) => ({
        entryId,
        symbols: Array.from(symbols).sort(),
      })).sort((left, right) => left.entryId.localeCompare(right.entryId)),
      diagnostics: ordered.flatMap((plan) => plan.diagnostics),
      modules: Array.from(new Set(ordered.flatMap((plan) => plan.modules))),
      conditions: Array.from(
        new Map(
          ordered
            .flatMap((plan) => plan.conditions)
            .map(
              (condition) => [JSON.stringify(condition), condition] as const,
            ),
        ).values(),
      ),
      conditionNames: Array.from(
        new Set(ordered.flatMap((plan) => plan.conditionNames)),
      ).sort(),
    });
  }

  if (mergedPlans.length === 0) {
    return plans;
  }
  return [...plans.filter((plan) => !groupedPlans.has(plan)), ...mergedPlans];
}

function orderMergedBundlePlans(
  plans: BundlePlan[],
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
): BundlePlan[] {
  const byEntrypoint = new Map<string, BundlePlan>();
  for (const plan of plans) {
    for (const entrypoint of plan.entrypoints) {
      byEntrypoint.set(`${entrypoint.envId}:${entrypoint.entryId}`, plan);
      const moduleIdentity = resolvedMapByEnv
        .get(entrypoint.envId)
        ?.get(entrypoint.entryId)?.moduleIdentity;
      if (moduleIdentity) {
        byEntrypoint.set(`${entrypoint.envId}:${moduleIdentity}`, plan);
      }
    }
  }
  const planSet = new Set(plans);
  const active = new Set<BundlePlan>();
  const visited = new Set<BundlePlan>();
  const ordered: BundlePlan[] = [];
  const visit = (plan: BundlePlan) => {
    if (visited.has(plan)) return;
    if (active.has(plan)) {
      throw new Error(
        `Cyclic dynamic bundle group through '${plan.entryId}' in '${plan.envId}'.`,
      );
    }
    active.add(plan);
    for (const dependency of plan.staticImports) {
      const target = byEntrypoint.get(`${plan.envId}:${dependency.entryId}`);
      if (target && planSet.has(target)) {
        visit(target);
      }
    }
    active.delete(plan);
    visited.add(plan);
    ordered.push(plan);
  };
  for (const plan of [...plans].sort((left, right) =>
    left.entryId.localeCompare(right.entryId),
  )) {
    visit(plan);
  }
  return ordered;
}

function coalescePhysicalBundlePlans(
  plans: BundlePlan[],
  hmr: boolean,
  fileRecords: FileRecord[],
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
  config: InternalBundlerConfig,
  resourcePlanFingerprints: Map<string, string[]>,
  conditionNames: string[],
): PhysicalBundlePlan[] {
  const portableIdentities = new Map(
    fileRecords.flatMap((record) => {
      const identity = record.moduleIdentity ?? portableHashIdentity(record.id);
      return [
        [record.id, identity] as const,
        [record.filePath, identity] as const,
      ];
    }),
  );
  const portableIdentity = (id: string): string =>
    portableIdentities.get(id) ?? portableHashIdentity(id);
  const plansByEntrypoint = new Map<string, BundlePlan>();
  for (const plan of plans) {
    for (const entrypoint of plan.entrypoints) {
      plansByEntrypoint.set(`${entrypoint.envId}:${entrypoint.entryId}`, plan);
      const moduleIdentity = resolvedMapByEnv
        .get(entrypoint.envId)
        ?.get(entrypoint.entryId)?.moduleIdentity;
      if (moduleIdentity) {
        plansByEntrypoint.set(`${entrypoint.envId}:${moduleIdentity}`, plan);
      }
    }
  }
  const localFingerprints = new Map(
    plans.map((plan) => [
      plan,
      contentHash(
        JSON.stringify({
          ...(hmr ? { envId: plan.envId } : {}),
          ...(conditionNames.length > 0
            ? { platform: config.envs[plan.envId].platform }
            : {}),
          entryId: portableIdentity(plan.entryId),
          entryKind: plan.entryKind,
          exportMode: plan.exportMode,
          entrypoints: plan.entrypoints
            .map((entrypoint) => ({
              entryId: portableIdentity(entrypoint.entryId),
              entryKind: entrypoint.entryKind,
              exportMode: entrypoint.exportMode,
            }))
            .sort((left, right) =>
              JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
          parts: portableBundleParts(plan.parts, portableIdentity),
          staticImports: plan.staticImports.map((item) => ({
            entryId: portableIdentity(item.entryId),
            symbols: item.symbols,
          })),
          modules: plan.modules.map(portableIdentity),
          resources:
            resourcePlanFingerprints.get(logicalBundlePlanKey(plan)) ?? [],
          conditions: plan.conditions.map((item) => ({
            moduleId: portableIdentity(item.moduleId),
            condition: item.condition,
          })),
          conditionNames: plan.conditionNames,
        }),
      ),
    ]),
  );
  const descriptors = new Map<BundlePlan, string>();
  const activePlans = new Set<BundlePlan>();
  const describePlan = (plan: BundlePlan): string => {
    const existing = descriptors.get(plan);
    if (existing) return existing;
    if (activePlans.has(plan)) {
      throw new Error(
        `Cyclic logical output reference through bundle '${plan.entryId}' in '${plan.envId}'.`,
      );
    }
    activePlans.add(plan);
    const descriptor = createPlanLinkDescriptor(
      plan,
      localFingerprints.get(plan) as string,
      (entryId, scopeId = plan.envId) => {
        const dependency = plansByEntrypoint.get(`${scopeId}:${entryId}`);
        return dependency
          ? contentHash(describePlan(dependency))
          : `missing:${scopeId}:${portableIdentity(entryId)}`;
      },
      portableIdentity,
      config,
    );
    activePlans.delete(plan);
    descriptors.set(plan, descriptor);
    return descriptor;
  };
  for (const plan of plans) {
    describePlan(plan);
  }
  if (!hmr) {
    const manualSignatures = new Map<string, string>();
    for (const plan of plans) {
      if (!plan.entryId.startsWith("bundler:manual:")) {
        continue;
      }
      const signature = contentHash(descriptors.get(plan) as string);
      const existing = manualSignatures.get(plan.entryId);
      if (existing && existing !== signature) {
        throw new Error(
          `Manual chunk '${plan.entryId}' groups modules with incompatible link behavior across environments.`,
        );
      }
      manualSignatures.set(plan.entryId, signature);
    }
  }

  const groups = new Map<string, BundlePlan[]>();
  for (const plan of plans) {
    const fingerprint = contentHash(descriptors.get(plan) as string);
    const key = `${plan.entryId}\0${fingerprint}`;
    const existing = groups.get(key) ?? [];
    existing.push(plan);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((group) => {
    const plan = group[0];
    const environmentIds = Array.from(
      new Set(group.map((item) => item.envId)),
    ).sort();
    const fingerprint = contentHashShort(
      JSON.stringify({
        entryId: portableIdentity(plan.entryId),
        linkFingerprint: contentHash(descriptors.get(plan) as string),
        parts: portableBundleParts(plan.parts, portableIdentity),
        staticImports: plan.staticImports.map((item) => ({
          entryId: portableIdentity(item.entryId),
          symbols: item.symbols,
        })),
      }),
      12,
    );
    return {
      id: plan.entryId.startsWith("bundler:")
        ? `${plan.entryId}:${fingerprint}`
        : `bundle:${fingerprint}`,
      environmentIds,
      entrypoints: Array.from(
        new Map(
          group
            .flatMap((item) => item.entrypoints)
            .map((entrypoint) => [
              `${entrypoint.envId}:${entrypoint.entryId}`,
              entrypoint,
            ]),
        ).values(),
      ),
      plan,
    };
  });
}

function logicalBundlePlanKey(
  plan: Pick<BundlePlan, "envId" | "entryId">,
): string {
  return JSON.stringify([plan.envId, plan.entryId]);
}

function createPlanLinkDescriptor(
  plan: BundlePlan,
  localFingerprint: string,
  dependencyFingerprint: (entryId: string, scopeId?: string) => string,
  portableIdentity: (id: string) => string,
  config: InternalBundlerConfig,
): string {
  const outputReferences = dedupeBundleReferences(plan.parts)
    .filter(
      (
        reference,
      ): reference is Extract<LinkReference, { kind: "output-url" }> =>
        reference.kind === "output-url" && reference.outputType === "script",
    )
    .map((reference) => ({
      symbol: reference.symbol,
      outputId: portableIdentity(reference.outputId),
      usage: reference.usage,
      includeDependencies: reference.includeDependencies === true,
      urlMode: reference.urlMode ?? "module-relative",
      dependencyFingerprint: dependencyFingerprint(
        reference.outputId,
        resolveReferenceScopeId(reference, plan.envId, config),
      ),
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return JSON.stringify({
    localFingerprint,
    staticImports: plan.staticImports.map((item) => ({
      entryId: portableIdentity(item.entryId),
      symbols: item.symbols,
      dependencyFingerprint: dependencyFingerprint(item.entryId),
    })),
    outputReferences,
  });
}

function finalizePhysicalBundleOutputs(
  physicalPlans: PhysicalBundlePlan[],
  config: InternalBundlerConfig,
  staticAssetFileNames: Map<string, string>,
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
  stylesByBundle: Map<string, string[]>,
  pendingFiles: PendingEmitFile[],
  resourceFingerprints = new Map<string, string[]>(),
  conditionNames: string[] = [],
): Map<string, PhysicalBundleOutput> {
  const byEntrypoint = new Map(
    physicalPlans.flatMap((physicalPlan) =>
      physicalPlan.entrypoints.map(
        (entrypoint) =>
          [`${entrypoint.envId}:${entrypoint.entryId}`, physicalPlan] as const,
      ),
    ),
  );
  for (const physicalPlan of physicalPlans) {
    for (const entrypoint of physicalPlan.entrypoints) {
      const moduleIdentity = resolvedMapByEnv
        .get(entrypoint.envId)
        ?.get(entrypoint.entryId)?.moduleIdentity;
      if (moduleIdentity) {
        byEntrypoint.set(`${entrypoint.envId}:${moduleIdentity}`, physicalPlan);
      }
    }
  }
  assertAcyclicLogicalModuleOutputs(physicalPlans, byEntrypoint, config);
  const outputs = new Map<string, PhysicalBundleOutput>();
  const visiting = new Set<string>();
  const scopeTokens = (physicalPlan: PhysicalBundlePlan) => {
    const environmentIds = Array.from(
      new Set(
        physicalPlan.environmentIds.map(
          (scopeId) => config.envs[scopeId].environmentId,
        ),
      ),
    ).sort();
    const targetIds = Array.from(
      new Set(
        physicalPlan.environmentIds.map(
          (scopeId) => config.envs[scopeId].targetId,
        ),
      ),
    ).sort();
    return {
      environment:
        environmentIds.length === 1
          ? environmentIds[0]
          : `shared-${environmentIds.join("-")}`,
      target:
        targetIds.length === 1 ? targetIds[0] : `shared-${targetIds.join("-")}`,
    };
  };

  const compute = (physicalPlan: PhysicalBundlePlan): PhysicalBundleOutput => {
    const existing = outputs.get(physicalPlan.id);
    if (existing) return existing;
    visiting.add(physicalPlan.id);
    const plan = physicalPlan.plan;
    const dependencyPhysicalPlan = (
      owner: PhysicalBundlePlan,
      entryId: string,
    ): PhysicalBundlePlan | undefined =>
      byEntrypoint.get(`${owner.plan.envId}:${entryId}`);
    const dependencyFileNames = (
      entryId: string,
      includeDependencies = false,
      scopeId = plan.envId,
    ): string[] | null => {
      const dependency = byEntrypoint.get(`${scopeId}:${entryId}`);
      if (!dependency) return null;
      const files: string[] = [];
      const visited = new Set<string>();
      const visit = (current: PhysicalBundlePlan): void => {
        if (visited.has(current.id)) return;
        visited.add(current.id);
        if (visiting.has(current.id)) {
          files.push(`cycle:${current.id}`);
          return;
        }
        files.push(compute(current).fileName);
        if (!includeDependencies) return;
        for (const item of current.plan.staticImports) {
          const nested = dependencyPhysicalPlan(current, item.entryId);
          if (nested) visit(nested);
        }
      };
      visit(dependency);
      return files;
    };
    const staticImports = plan.staticImports.map((item) => ({
      entryId: item.entryId,
      symbols: item.symbols,
      fileName: dependencyFileNames(item.entryId)?.[0] ?? null,
    }));
    const linkedAssets = dedupeBundleReferences(plan.parts)
      .filter(
        (
          reference,
        ): reference is Extract<LinkReference, { kind: "asset-url" }> =>
          reference.kind === "asset-url",
      )
      .map((reference) => ({
        symbol: reference.symbol,
        fileName: staticAssetFileNames.get(reference.assetId),
      }))
      .filter(
        (
          item,
        ): item is {
          symbol: string;
          fileName: string;
        } => Boolean(item.fileName),
      )
      .sort((left, right) => left.symbol.localeCompare(right.symbol));
    const pendingOutputs = collectPendingLogicalOutputs(pendingFiles);
    const linkedOutputs = dedupeBundleReferences(plan.parts)
      .filter(
        (
          reference,
        ): reference is Extract<LinkReference, { kind: "output-url" }> & {
          symbol: string;
        } =>
          reference.kind === "output-url" &&
          reference.usage !== "css-variable" &&
          typeof reference.symbol === "string",
      )
      .map((reference) => {
        let fileNames: string[] | null | undefined;
        let entryExports = false;
        if (reference.outputType === "script") {
          const referenceScopeId = resolveReferenceScopeId(
            reference,
            plan.envId,
            config,
          );
          const dependency = byEntrypoint.get(
            `${referenceScopeId}:${reference.outputId}`,
          );
          entryExports = dependency?.plan.exportMode === "entry";
          fileNames = dependencyFileNames(
            reference.outputId,
            reference.includeDependencies === true,
            referenceScopeId,
          );
          if (fileNames?.some((fileName) => fileName.startsWith("cycle:"))) {
            throw new Error(
              `Cyclic logical output reference '${reference.outputId}' from '${plan.entryId}'.`,
            );
          }
        } else if (reference.outputType === "style") {
          const referenceScopeId = resolveReferenceScopeId(
            reference,
            plan.envId,
            config,
          );
          const styles =
            stylesByBundle.get(`${referenceScopeId}:${reference.outputId}`) ??
            [];
          if (styles.length > 1) {
            throw new Error(
              `Logical style output '${reference.outputId}' resolves to multiple files.`,
            );
          }
          fileNames = styles[0] ? [styles[0]] : [];
        } else {
          const fileName =
            staticAssetFileNames.get(reference.outputId) ??
            pendingOutputs.get(reference.outputId)?.fileName;
          fileNames = fileName ? [fileName] : [];
        }
        if (!fileNames || fileNames.length === 0) {
          throw new Error(
            `Missing logical output '${reference.outputId}' referenced by '${plan.entryId}'.`,
          );
        }
        return {
          outputId: reference.outputId,
          outputType: reference.outputType,
          symbol: reference.symbol,
          usage: reference.usage ?? "javascript",
          includeDependencies: reference.includeDependencies === true,
          entryExports:
            reference.includeDependencies === true && entryExports === true,
          urlMode:
            reference.outputType === "script"
              ? (reference.urlMode ?? "module-relative")
              : "module-relative",
          fileNames,
          contentHash: pendingOutputs.get(reference.outputId)?.contentHash,
        };
      })
      .sort((left, right) => left.symbol.localeCompare(right.symbol));
    const hash = contentHashShort(
      JSON.stringify({
        code: plan.parts.map((part) => part.code),
        maps: plan.parts.map((part) => part.map),
        staticImports: staticImports.map((item) => ({
          symbols: item.symbols,
          fileName: item.fileName,
        })),
        linkedAssets,
        linkedOutputs,
        resourceFingerprints: resourceFingerprints.get(physicalPlan.id) ?? [],
        conditionNames: conditionNames.length > 0 ? conditionNames : undefined,
        rootURL: config.outputs.rootURL,
        outputFilePattern: config.outputs.fileName,
        outputEntry: sanitizeOutputName(plan.entryId),
        outputScope: scopeTokens(physicalPlan),
        sourceMap: config.outputs.sourceMap,
      }),
    );
    const scope = scopeTokens(physicalPlan);
    const fileName = config.outputs.fileName
      ? config.outputs.fileName
          .replaceAll("[entry]", sanitizeOutputName(plan.entryId))
          .replaceAll("[environment]", scope.environment)
          .replaceAll("[target]", scope.target)
          .replaceAll("[hash]", hash)
      : `bundle.${scope.target}.${scope.environment}.${hash}.js`;
    const output = { plan: physicalPlan, hash, fileName };
    outputs.set(physicalPlan.id, output);
    visiting.delete(physicalPlan.id);
    return output;
  };

  for (const physicalPlan of physicalPlans) {
    compute(physicalPlan);
  }
  return outputs;
}

function assertAcyclicLogicalModuleOutputs(
  physicalPlans: PhysicalBundlePlan[],
  byEntrypoint: Map<string, PhysicalBundlePlan>,
  config: InternalBundlerConfig,
): void {
  const dependencies = new Map<string, Set<string>>();
  for (const physicalPlan of physicalPlans) {
    const plan = physicalPlan.plan;
    const targets = new Set<string>();
    for (const item of plan.staticImports) {
      const target = byEntrypoint.get(`${plan.envId}:${item.entryId}`);
      if (target) targets.add(target.id);
    }
    for (const reference of dedupeBundleReferences(plan.parts)) {
      if (
        reference.kind !== "output-url" ||
        reference.outputType !== "script"
      ) {
        continue;
      }
      const target = byEntrypoint.get(
        `${resolveReferenceScopeId(reference, plan.envId, config)}:${reference.outputId}`,
      );
      if (target) targets.add(target.id);
    }
    dependencies.set(physicalPlan.id, targets);
  }
  assertAcyclicOutputGraph(dependencies);
}

function assertAcyclicOutputGraph(
  dependencies: Map<string, Set<string>>,
): void {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (active.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      throw new Error(
        `Cyclic logical output reference: ${cycle.join(" -> ")}.`,
      );
    }
    active.add(id);
    stack.push(id);
    for (const dependency of dependencies.get(id) ?? []) {
      visit(dependency);
    }
    stack.pop();
    active.delete(id);
    visited.add(id);
  };
  for (const id of dependencies.keys()) visit(id);
}

async function collectTransformedModules(
  entries: InternalEntrySpec[],
  envs: string[],
  cacheDir: string,
  cacheNamespace: string,
  remoteCache: RemoteCacheConfig | undefined,
  plugins: NormalizedPlugin[],
  workerProfile: WorkerTransformProfile,
  config: InternalBundlerConfig,
  buildMode: string,
  pool: WorkerPool,
  resolver: Resolver,
  debugOutputDir: string | null,
): Promise<ModuleCollection> {
  const headersByEnv = new Map<string, Map<string, FileRecord>>();
  for (const envId of envs) {
    headersByEnv.set(envId, new Map<string, FileRecord>());
  }
  const resolvedMapByEnv = new Map<string, Map<string, ModuleResolution>>();
  for (const envId of envs) {
    resolvedMapByEnv.set(envId, new Map());
  }
  const scheduled = new Set<string>();
  const dynamicEntries = new Map<string, InternalEntrySpec>();
  const fileRecords: FileRecord[] = [];
  const pending = new Map<
    string,
    { module: ScheduledModule; envs: Set<string> }
  >();

  const schedule = (module: ScheduledModule) => {
    const key = `${module.envId}:${module.id}`;
    if (scheduled.has(key)) {
      return;
    }
    scheduled.add(key);
    const resolvedMap = resolvedMapByEnv.get(module.envId);
    resolvedMap?.set(module.id, {
      id: module.id,
      moduleIdentity: module.moduleIdentity,
      filePath: module.filePath,
      scopeId: module.envId,
      pkg: module.pkg,
      target: {
        kind: "file",
        moduleId: module.moduleIdentity,
        canonicalPath: module.canonicalPath,
      },
      type: module.type,
      representation: module.representation,
      meta: module.meta,
    });
    resolvedMap?.set(module.moduleIdentity, {
      id: module.id,
      moduleIdentity: module.moduleIdentity,
      filePath: module.filePath,
      scopeId: module.envId,
      pkg: module.pkg,
      target: {
        kind: "file",
        moduleId: module.moduleIdentity,
        canonicalPath: module.canonicalPath,
      },
      type: module.type,
      representation: module.representation,
      meta: module.meta,
    });
    const batchKey = JSON.stringify({
      id: module.id,
      moduleIdentity: module.moduleIdentity,
      filePath: module.filePath,
      canonicalPath: module.canonicalPath,
      type: module.type,
      representation: module.representation,
      meta: module.meta,
      source: module.source,
      sourceMap: module.sourceMap,
      resolveFrom: module.resolveFrom,
      environment: config.envs[module.envId].environmentId,
    });
    const batch = pending.get(batchKey);
    if (batch) {
      batch.envs.add(module.envId);
    } else {
      pending.set(batchKey, {
        module,
        envs: new Set([module.envId]),
      });
    }
  };

  for (const entry of entries) {
    const filePath = path.resolve(entry.path);
    const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
    const pkg = readPkgSafe(pkgRoot);
    const canonicalPath = packagePathIdentity(pkg, filePath);
    const type = inferEntryModuleType(entry, filePath);
    const baseModuleIdentity = entry.moduleIdentity ?? canonicalPath;
    for (const envId of entry.envs ?? envs) {
      const environmentId = config.envs[envId].environmentId;
      const moduleIdentity =
        entry.entryNodeId ??
        `${baseModuleIdentity}::environment=${encodeURIComponent(environmentId)}`;
      entry.entryNodeId = moduleIdentity;
      schedule({
        id: moduleIdentity,
        moduleIdentity,
        filePath,
        envId,
        pkg,
        type,
        representation: undefined,
        canonicalPath,
        source: entry.source,
        sourceMap: entry.sourceMap,
        resolveFrom: entry.resolveFrom,
      });
      const resolution = resolvedMapByEnv.get(envId)?.get(moduleIdentity);
      if (resolution) {
        resolvedMapByEnv.get(envId)?.set(entry.path, resolution);
        resolvedMapByEnv.get(envId)?.set(entry.id, resolution);
      }
    }
  }

  while (pending.size > 0) {
    const wave = Array.from(pending.values());
    pending.clear();
    await Promise.all(
      wave.map((batch) => {
        const batchEnvs = envs.filter((envId) => batch.envs.has(envId));
        return transformModule(
          { ...batch.module, envId: batchEnvs[0] },
          batchEnvs,
          envs,
          cacheDir,
          cacheNamespace,
          remoteCache,
          plugins,
          workerProfile,
          config,
          buildMode,
          pool,
          resolver,
          debugOutputDir,
          headersByEnv,
          resolvedMapByEnv,
          dynamicEntries,
          fileRecords,
          schedule,
        );
      }),
    );
  }

  return {
    headersByEnv,
    dynamicEntries: Array.from(dynamicEntries.values()),
    resolvedMapByEnv,
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
  config: InternalBundlerConfig,
  buildMode: string,
  pool: WorkerPool,
  resolver: Resolver,
  debugOutputDir: string | null,
  headersByEnv: Map<string, Map<string, FileRecord>>,
  resolvedMapByEnv: Map<string, Map<string, ModuleResolution>>,
  dynamicEntries: Map<string, InternalEntrySpec>,
  fileRecords: FileRecord[],
  schedule: (module: ScheduledModule) => void,
): Promise<void> {
  const loadedModule = await readModuleSource(module);
  const syntax = resolveJsLikeSyntax(config, module.filePath, module.type);
  const sourceMapOutput = resolveSourceMapOutput(config.outputs.sourceMap);
  const outputDir = path.resolve(config.outputs.outDir);
  const sourceFileName = portableSourceName(module.canonicalPath);
  const requestBase = {
    id: module.id,
    moduleIdentity: module.moduleIdentity,
    realPath: module.filePath,
    code: loadedModule.code,
    sourceBytes: loadedModule.sourceBytes,
    moduleType: module.type,
    importRepresentation: module.representation,
    canonicalPath: module.canonicalPath,
    resolutionMeta: module.meta,
    buildMode,
    transformConfig: resolvedTransformConfig(config),
    environmentVariables: config.environmentVariables ?? {},
    pkg: module.pkg,
    envs,
    allEnvIds,
    environments: Object.fromEntries(
      allEnvIds.map((envId) => [envId, config.envs[envId].environmentId]),
    ),
    targetIds: Object.fromEntries(
      allEnvIds.map((envId) => [envId, config.envs[envId].targetId]),
    ),
    targets: Object.fromEntries(
      allEnvIds.map((envId) => [envId, config.envs[envId].platform]),
    ),
    defines: Object.fromEntries(
      allEnvIds.map((envId) => [envId, config.envs[envId].defines]),
    ),
    cacheDir,
    sharedCacheDir: path.join(
      path.dirname(path.dirname(cacheDir)),
      "shared-transforms-v1",
    ),
    cacheNamespace,
    remoteCache,
    syntax,
    mapByEnv: loadedModule.map
      ? Object.fromEntries(envs.map((envId) => [envId, loadedModule.map]))
      : undefined,
    sourceMap: sourceMapOutput
      ? {
          sourceFileName,
          outputDir,
          sourcesContent: sourceMapOutput.sourcesContent,
        }
      : undefined,
    workerProfile,
    dev: {
      hmr: config.dev?.hmr === true,
    },
  };
  const resolvedDuringTransform = new Map<string, ModuleResolution>();
  const rememberResolution = (
    requestScopeId: string,
    request: WorkerImportRequest,
    resolved: ModuleResolution,
  ): void => {
    resolvedDuringTransform.set(
      workerResolutionKey(requestScopeId, request),
      resolved,
    );
    if (resolved.target.kind === "runtime") {
      return;
    }
    resolvedDuringTransform.set(
      workerResolvedTargetKey(requestScopeId, resolved.target.moduleId),
      resolved,
    );
    const dependencyScopeId = resolved.scopeId ?? requestScopeId;
    const resolvedMap = resolvedMapByEnv.get(dependencyScopeId);
    resolvedMap?.set(resolved.id, resolved);
    resolvedMap?.set(resolved.moduleIdentity, resolved);
    schedule({
      id: resolved.id,
      moduleIdentity: resolved.moduleIdentity,
      filePath: resolved.filePath,
      envId: dependencyScopeId,
      pkg: resolved.pkg,
      type: resolved.type,
      representation: resolved.representation,
      canonicalPath: resolved.target.canonicalPath,
      meta: resolved.meta,
    });
  };
  const response = (await pool.run(requestBase, async (payload) => {
    const coordinatorRequest = payload as WorkerCoordinatorRequest;
    if (coordinatorRequest.type !== "resolve-imports") {
      throw new Error(
        `Unknown worker coordinator request '${String(coordinatorRequest.type)}'.`,
      );
    }
    return resolveImportRequestsForEnvs(
      module,
      envs,
      resolver,
      coordinatorRequest.requestsByEnv,
      rememberResolution,
    );
  })) as WorkerTransformResponse;
  for (const variant of response.variants ?? []) {
    const existing = fileRecords.find(
      (record) =>
        record.variantId === variant.variantId &&
        record.id === variant.record.id,
    );
    if (existing) {
      existing.targetIds = Array.from(
        new Set([
          ...(existing.targetIds ?? []),
          ...(variant.targetIds ?? variant.record.targetIds ?? []),
        ]),
      ).sort();
      const environmentIds = Array.from(
        new Set([
          ...(existing.environmentIds ?? existing.envs ?? []),
          ...variant.environmentIds,
        ]),
      ).sort();
      existing.environmentIds = environmentIds;
      existing.envs = environmentIds;
    } else {
      fileRecords.push(variant.record);
    }
  }
  for (const [envId, fileRecord] of Object.entries(response.fileRecordsByEnv)) {
    if (debugOutputDir) {
      await writeDebugTransform({
        debugOutputDir,
        module,
        envId,
        loadedModule,
        fileRecord,
        cacheHit: response.cacheHit === true,
      });
    }
    headersByEnv.get(envId)?.set(fileRecord.id, fileRecord);
    if (
      !fileRecord.variantId ||
      !fileRecords.some(
        (record) =>
          record.variantId === fileRecord.variantId &&
          record.id === fileRecord.id,
      )
    ) {
      fileRecords.push(fileRecord);
    }

    if (fileRecord.flags.hasTopLevelAwait) {
      throw new Error(
        `E_TLA: Top-level 'await' is not supported (v1). at ${module.filePath}`,
      );
    }

    const { dependencies, dynamicEntries: discoveredDynamics } =
      await discoverModulesFromHeader(
        fileRecord,
        envId,
        resolver,
        module,
        config,
        resolvedDuringTransform,
      );
    for (const resolved of dependencies) {
      if (resolved.target.kind === "runtime") {
        continue;
      }
      const dependencyScopeId = resolved.scopeId ?? envId;
      const resolvedMap = resolvedMapByEnv.get(dependencyScopeId);
      resolvedMap?.set(resolved.id, resolved);
      resolvedMap?.set(resolved.moduleIdentity, resolved);
      schedule({
        id: resolved.id,
        moduleIdentity: resolved.moduleIdentity,
        filePath: resolved.filePath,
        envId: dependencyScopeId,
        pkg: resolved.pkg,
        type: resolved.type,
        representation: resolved.representation,
        canonicalPath: resolved.target.canonicalPath,
        meta: resolved.meta,
      });
    }

    for (const dynamicEntry of discoveredDynamics) {
      const dynamicResolvedMap = resolvedMapByEnv.get(dynamicEntry.envId);
      dynamicResolvedMap?.set(dynamicEntry.id, dynamicEntry);
      dynamicResolvedMap?.set(dynamicEntry.moduleIdentity, dynamicEntry);
      dynamicResolvedMap?.set(
        dynamicEntry.entryId ?? dynamicEntry.id,
        dynamicEntry,
      );
      dynamicResolvedMap?.set(dynamicEntry.filePath, dynamicEntry);
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
          entryNodeId: dynamicEntry.id,
          exportMode: dynamicEntry.exportMode,
          entryKind: dynamicEntry.entryKind ?? "dynamic",
        });
      }
      for (const targetEnv of dynamicEntry.entryEnvs ?? [envId]) {
        if (!allEnvIds.includes(targetEnv)) {
          continue;
        }
        schedule({
          id: dynamicEntry.id,
          moduleIdentity: dynamicEntry.moduleIdentity,
          filePath: dynamicEntry.filePath,
          envId: targetEnv,
          pkg: dynamicEntry.pkg,
          type: dynamicEntry.type,
          representation: dynamicEntry.representation,
          canonicalPath:
            dynamicEntry.target.kind === "file"
              ? dynamicEntry.target.canonicalPath
              : dynamicEntry.moduleIdentity,
          meta: dynamicEntry.meta,
        });
      }
    }
  }
}

async function discoverModulesFromHeader(
  irHeader: FileRecord,
  envId: string,
  resolver: Resolver,
  owner: ScheduledModule,
  config: InternalBundlerConfig,
  resolvedDuringTransform: Map<string, ModuleResolution>,
): Promise<{
  dependencies: ModuleResolution[];
  dynamicEntries: DynamicEntryDiscovery[];
}> {
  const dependencyPromises: Array<Promise<ModuleResolution>> = [];
  const dynamicPromises: Array<Promise<DynamicEntryDiscovery>> = [];
  const resolveRecordedTarget = (
    target: Extract<ModuleResolution["target"], { kind: "file" }>,
    fallback: () => Promise<ModuleResolution>,
  ): Promise<ModuleResolution> =>
    Promise.resolve(
      resolvedDuringTransform.get(
        workerResolvedTargetKey(envId, target.moduleId),
      ),
    ).then((resolved) => resolved ?? fallback());

  for (const importEntry of irHeader.imports) {
    if (importEntry.kind === "type" || importEntry.target.kind === "runtime") {
      continue;
    }
    dependencyPromises.push(
      resolveRecordedTarget(importEntry.target, () =>
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
          irHeader.resolutionMeta,
        ),
      ),
    );
  }

  for (const conditionalImport of irHeader.conditionalImports) {
    if (
      !conditionalImport.elseSource ||
      conditionalImport.elseTarget?.kind !== "file"
    ) {
      continue;
    }
    const ownerImport = irHeader.imports.find(
      (entry) =>
        entry.request === conditionalImport.request &&
        entry.condition !== undefined,
    );
    const elseAttributes = ownerImport?.attributes
      ? Object.fromEntries(
          Object.entries(ownerImport.attributes).filter(
            ([key]) => key !== "condition" && key !== "else",
          ),
        )
      : undefined;
    const elseRequest =
      conditionalImport.elseRequest ?? conditionalImport.elseSource;
    dependencyPromises.push(
      resolveRecordedTarget(conditionalImport.elseTarget, () =>
        resolver(
          irHeader.id,
          irHeader.filePath,
          elseRequest,
          envId,
          "conditional-else",
          elseAttributes && Object.keys(elseAttributes).length > 0
            ? elseAttributes
            : undefined,
          irHeader.resolutionMeta,
        ),
      ),
    );
  }

  for (const reexport of [
    ...irHeader.exportStars,
    ...irHeader.reexportsNamed,
  ]) {
    if (reexport.target.kind === "runtime") {
      continue;
    }
    dependencyPromises.push(
      resolveRecordedTarget(reexport.target, () =>
        resolver(
          irHeader.id,
          irHeader.filePath,
          reexport.request ?? reexport.source,
          envId,
          "reexport",
          undefined,
          irHeader.resolutionMeta,
        ),
      ),
    );
  }

  for (const entrypoint of irHeader.discoveredEntrypoints) {
    const normalized = entrypoint;
    if (normalized.self === "normal") {
      const moduleIdentity =
        normalized.moduleIdentity ??
        (typeof irHeader.resolutionMeta?.normalModuleIdentity === "string"
          ? irHeader.resolutionMeta.normalModuleIdentity
          : undefined);
      const moduleType =
        normalized.moduleType ??
        (irHeader.resolutionMeta?.normalType === "javascript" ||
        irHeader.resolutionMeta?.normalType === "css" ||
        irHeader.resolutionMeta?.normalType === "asset"
          ? irHeader.resolutionMeta.normalType
          : undefined);
      if (!moduleIdentity || !moduleType) {
        throw new Error(
          `Malformed self representation entrypoint in '${irHeader.moduleIdentity ?? irHeader.id}'.`,
        );
      }
      for (const targetEnv of resolveDiscoveredScopes(
        normalized,
        envId,
        config,
      )) {
        dynamicPromises.push(
          Promise.resolve({
            id: moduleIdentity,
            moduleIdentity,
            filePath: owner.filePath,
            pkg: owner.pkg,
            target: {
              kind: "file" as const,
              moduleId: moduleIdentity,
              canonicalPath: owner.canonicalPath,
            },
            type: moduleType,
            representation: undefined,
            envId: targetEnv,
            entryId: owner.filePath,
            entryEnvs: [targetEnv],
            exportMode: "dynamic",
            entryKind:
              normalized.entryKind === "shared" ||
              normalized.entryKind === "manual"
                ? normalized.entryKind
                : "dynamic",
          }),
        );
      }
      continue;
    }
    if (!normalized.request) {
      throw new Error(
        `Discovered entrypoint in '${irHeader.moduleIdentity ?? irHeader.id}' must provide request or self: 'normal'.`,
      );
    }
    for (const targetEnv of resolveDiscoveredScopes(
      normalized,
      envId,
      config,
    )) {
      const recorded = resolvedDuringTransform.get(
        workerResolutionKey(targetEnv, {
          kind: "dynamic-import",
          request: normalized.request,
        }),
      );
      dynamicPromises.push(
        (recorded
          ? Promise.resolve(recorded)
          : resolver(
              irHeader.id,
              irHeader.filePath,
              normalized.request,
              targetEnv,
              "dynamic-import",
            )
        ).then((resolved) => ({
          ...resolved,
          envId: targetEnv,
          entryId: resolved.filePath,
          entryEnvs: [targetEnv],
          exportMode: "dynamic",
          entryKind:
            normalized.entryKind === "shared" ||
            normalized.entryKind === "manual"
              ? normalized.entryKind
              : "dynamic",
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

function resolveDiscoveredScopes(
  entry: {
    environment?: string;
    targets?: string[];
  },
  ownerScopeId: string,
  config: InternalBundlerConfig,
): string[] {
  const owner = config.envs[ownerScopeId];
  const environmentId = entry.environment ?? owner.environmentId;
  if (!config.environments[environmentId]) {
    throw new Error(`Unknown discovered environment '${environmentId}'.`);
  }
  const targetIds = entry.targets ?? [owner.targetId];
  return targetIds.map((targetId) => {
    if (!config.targets[targetId]) {
      throw new Error(`Unknown discovered target '${targetId}'.`);
    }
    return buildScopeId(environmentId, targetId);
  });
}

async function readModuleSource(module: ScheduledModule): Promise<{
  code: string;
  sourceBytes?: Uint8Array;
  map?: string;
}> {
  if (module.source != null) {
    return { code: module.source, map: module.sourceMap };
  }
  if (module.type === "asset") {
    const sourceBytes = await fs.readFile(module.filePath);
    return { code: "", sourceBytes };
  }
  return { code: await fs.readFile(module.filePath, "utf8") };
}

async function prepareDebugOutput(
  config: InternalBundlerConfig,
  cacheBaseDir: string,
): Promise<string | null> {
  if (
    config.debug !== undefined &&
    config.debug !== false &&
    config.debug !== true
  ) {
    throw new Error("Bundler debug must be a boolean.");
  }
  if (config.debug !== true) {
    return null;
  }
  const debugOutputDir = path.join(
    findCacheContainer(cacheBaseDir),
    "__DEBUG__",
  );
  await fs.rm(debugOutputDir, { recursive: true, force: true });
  await fs.mkdir(debugOutputDir, { recursive: true });
  return debugOutputDir;
}

function findCacheContainer(cacheBaseDir: string): string {
  let current = path.resolve(cacheBaseDir);
  while (true) {
    if (path.basename(current) === ".cache") {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(cacheBaseDir);
    }
    current = parent;
  }
}

async function writeDebugTransform({
  debugOutputDir,
  module,
  envId,
  loadedModule,
  fileRecord,
  cacheHit,
}: {
  debugOutputDir: string;
  module: ScheduledModule;
  envId: string;
  loadedModule: Awaited<ReturnType<typeof readModuleSource>>;
  fileRecord: FileRecord;
  cacheHit: boolean;
}): Promise<void> {
  const canonicalSegments = debugPathSegments(module.canonicalPath);
  const identitySuffix = module.moduleIdentity.startsWith(module.canonicalPath)
    ? module.moduleIdentity.slice(module.canonicalPath.length)
    : module.moduleIdentity;
  const variant = identitySuffix
    ? debugPathSegment(identitySuffix.replace(/^:+/, ""))
    : `as-${debugPathSegment(module.representation ?? "module")}`;
  const directory = path.join(
    debugOutputDir,
    ...canonicalSegments,
    `__${variant || "module"}`,
    debugPathSegment(envId),
  );
  const cellsDirectory = path.join(directory, "cells");
  const outputsDirectory = path.join(directory, "outputs");
  await Promise.all([
    fs.mkdir(cellsDirectory, { recursive: true }),
    fs.mkdir(outputsDirectory, { recursive: true }),
  ]);

  const inputExtension = path.extname(module.filePath) || ".txt";
  const input = loadedModule.sourceBytes ?? Buffer.from(loadedModule.code);
  await fs.writeFile(path.join(directory, `input${inputExtension}`), input);

  const transformedCode = fileRecord.codeByEnv[envId];
  if (transformedCode) {
    await fs.writeFile(
      path.join(outputsDirectory, "module.js"),
      transformedCode,
    );
  }
  const transformedMap = fileRecord.mapByEnv[envId];
  if (transformedMap) {
    await fs.writeFile(
      path.join(outputsDirectory, "module.js.map"),
      transformedMap,
    );
  }

  await Promise.all(
    fileRecord.cells.map(async (cell, index) => {
      const stem = `${String(index).padStart(3, "0")}-${debugPathSegment(cell.id)}`;
      const code = await readDebugArtifact(cell.code, cell.artifactPath);
      if (code) {
        await fs.writeFile(path.join(cellsDirectory, `${stem}.js`), code);
      }
      const sourceMap = await readDebugArtifact(cell.map, cell.mapArtifactPath);
      if (sourceMap) {
        await fs.writeFile(
          path.join(cellsDirectory, `${stem}.js.map`),
          sourceMap,
        );
      }
    }),
  );

  await Promise.all(
    Object.entries(fileRecord.extraOutputs ?? {}).map(
      async ([name, output]) => {
        const contents = await readDebugArtifact(
          output.contents,
          output.artifactPath,
        );
        if (contents) {
          await fs.writeFile(
            path.join(
              outputsDirectory,
              `${debugPathSegment(name)}${debugOutputExtension(name, output.metadata, contents)}`,
            ),
            contents,
          );
        }
        const sourceMap = await readDebugArtifact(
          output.map,
          output.mapArtifactPath,
        );
        if (sourceMap) {
          await fs.writeFile(
            path.join(outputsDirectory, `${debugPathSegment(name)}.map`),
            sourceMap,
          );
        }
      },
    ),
  );

  await fs.writeFile(
    path.join(directory, "record.json"),
    JSON.stringify(
      {
        input: {
          canonicalPath: module.canonicalPath,
          moduleIdentity: module.moduleIdentity,
          type: module.type,
          representation: module.representation,
          envId,
          cacheHit,
        },
        output: debugRecord(fileRecord),
      },
      null,
      2,
    ),
  );
}

function debugPathSegments(identity: string): string[] {
  return identity
    .replace(/::/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map(debugPathSegment);
}

function debugPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@+=()-]+/g, "_").slice(0, 180);
}

async function readDebugArtifact(
  inline: string | Uint8Array | undefined,
  artifactPath: string | undefined,
): Promise<string | Uint8Array | null> {
  if (inline !== undefined) {
    return inline;
  }
  if (!artifactPath) {
    return null;
  }
  try {
    return await fs.readFile(artifactPath);
  } catch {
    return null;
  }
}

function debugOutputExtension(
  name: string,
  metadata: unknown,
  contents: string | Uint8Array,
): string {
  if (name.startsWith("bundler-css-cell:")) {
    return ".css";
  }
  if (name === "bundler-asset" && metadata && typeof metadata === "object") {
    const extension = (metadata as { extension?: unknown }).extension;
    if (typeof extension === "string" && /^\.[a-zA-Z0-9]+$/.test(extension)) {
      return extension;
    }
  }
  return typeof contents === "string" ? ".txt" : ".bin";
}

function debugRecord(fileRecord: FileRecord): unknown {
  return JSON.parse(
    JSON.stringify(fileRecord, (key, value) => {
      if (
        key === "code" ||
        key === "map" ||
        key === "contents" ||
        key === "artifactPath" ||
        key === "mapArtifactPath" ||
        key === "sourceContents"
      ) {
        return undefined;
      }
      if (
        key === "root" &&
        typeof value === "string" &&
        path.isAbsolute(value)
      ) {
        return "<package-root>";
      }
      return value;
    }),
  );
}

async function resolveImportRequestsForEnvs(
  module: Pick<ScheduledModule, "id" | "filePath" | "resolveFrom" | "meta">,
  envs: string[],
  resolver: Resolver,
  requestsByEnv: Record<string, WorkerImportRequest[]>,
  onResolve?: (
    envId: string,
    request: WorkerImportRequest,
    resolved: ModuleResolution,
  ) => void,
): Promise<
  Record<
    string,
    Record<
      string,
      {
        target: ModuleResolution["target"];
        type: ModuleResolution["type"];
        representation?: ModuleResolution["representation"];
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
        target: ModuleResolution["target"];
        type: ModuleResolution["type"];
        representation?: ModuleResolution["representation"];
        meta?: Record<string, unknown>;
      }
    >
  > = {};

  await Promise.all(
    envs.map(async (envId) => {
      const entries = await Promise.all(
        (requestsByEnv[envId] ?? []).map(async (request) => {
          const resolved = await resolver(
            module.id,
            module.resolveFrom ?? module.filePath,
            request.request,
            envId,
            request.kind,
            request.importAttributes,
            module.meta,
          );
          onResolve?.(envId, request, resolved);
          return [
            request.key,
            {
              target: resolved.target,
              type: resolved.type,
              representation: resolved.representation,
              meta: resolved.meta,
            },
          ] as const;
        }),
      );
      resolvedByEnv[envId] = Object.fromEntries(entries);
    }),
  );

  return resolvedByEnv;
}

function workerResolutionKey(
  envId: string,
  request: Pick<WorkerImportRequest, "kind" | "request" | "importAttributes">,
): string {
  return JSON.stringify([
    envId,
    request.kind,
    request.request,
    request.importAttributes ?? null,
  ]);
}

function workerResolvedTargetKey(envId: string, moduleId: string): string {
  return JSON.stringify([envId, "target", moduleId]);
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
        sourceLookupKey({
          source: conditionalImport.elseSource,
          request: conditionalImport.elseRequest,
          target: conditionalImport.elseTarget,
        }),
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
      sourceLookupKey({
        source: conditionalImport.elseSource,
        request: conditionalImport.elseRequest,
        target: conditionalImport.elseTarget,
      }),
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

async function readCellPart(
  cell: CellRecord,
  sourceContents?: Record<string, string>,
): Promise<BundlePart> {
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
  return {
    code,
    map,
    sourceContents,
    references: cell.linkReferences,
  };
}

function prependLinkReferencePrelude(
  draft: BundlePlanDraftWithHmr,
  target: "node" | "browser",
): BundlePlanDraftWithHmr {
  const references = dedupeBundleReferences(draft.orderedParts);
  if (references.length === 0) {
    return draft;
  }
  const code = emitLinkReferencePrelude(references, target);
  return {
    ...draft,
    orderedParts: [{ code }, ...draft.orderedParts],
  };
}

function dedupeBundleReferences(parts: BundlePart[]): LinkReference[] {
  const references = new Map<string, LinkReference>();
  for (const reference of parts.flatMap((part) => part.references ?? [])) {
    const existing = references.get(reference.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(reference)) {
      throw new Error(`Conflicting link reference '${reference.id}'.`);
    }
    references.set(reference.id, reference);
  }
  return Array.from(references.values()).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function emitLinkReferencePrelude(
  references: LinkReference[],
  target: "node" | "browser",
): string {
  const moduleReferences = references.filter(
    (
      reference,
    ): reference is Extract<
      LinkReference,
      { kind: "module-url" | "module-filename" | "module-dirname" }
    > => reference.kind.startsWith("module-"),
  );
  const needsFilename = moduleReferences.some(
    (reference) => reference.kind === "module-filename",
  );
  const needsDirname = moduleReferences.some(
    (reference) => reference.kind === "module-dirname",
  );
  if (target === "browser" && (needsFilename || needsDirname)) {
    throw new Error(
      "Node path references cannot be linked into a browser-target bundle.",
    );
  }
  const lines: string[] = [];
  if (needsDirname) {
    lines.push(
      'import { dirname as __bundler_path_dirname } from "node:path";',
    );
  }
  if (needsFilename || needsDirname) {
    lines.push(
      'import { fileURLToPath as __bundler_file_url_to_path } from "node:url";',
      "const __bundler_bundle_filename = __bundler_file_url_to_path(import.meta.url);",
    );
  }
  if (needsDirname) {
    lines.push(
      "const __bundler_bundle_dirname = __bundler_path_dirname(__bundler_bundle_filename);",
    );
  }
  for (const reference of moduleReferences) {
    const value =
      reference.kind === "module-url"
        ? "import.meta.url"
        : reference.kind === "module-filename"
          ? "__bundler_bundle_filename"
          : "__bundler_bundle_dirname";
    lines.push(`const ${reference.symbol} = ${value};`);
  }
  return lines.join("\n");
}

function emitAssetReferencePrelude(
  references: LinkReference[],
  assetFileNames: Map<string, string>,
  rootURL = "/",
): string {
  return references
    .filter(
      (reference): reference is Extract<LinkReference, { kind: "asset-url" }> =>
        reference.kind === "asset-url",
    )
    .map((reference) => {
      const assetFileName = assetFileNames.get(reference.assetId);
      if (!assetFileName) {
        throw new Error(
          `Missing emitted asset for reference '${reference.assetId}'.`,
        );
      }
      const url = joinRootURL(rootURL, assetFileName);
      return `const ${reference.symbol} = ${JSON.stringify(url)};`;
    })
    .join("\n");
}

function resolveReferenceScopeId(
  reference: Extract<LinkReference, { kind: "output-url" }>,
  ownerScopeId: string,
  config: InternalBundlerConfig,
): string {
  if (!reference.environment && !reference.targetId) return ownerScopeId;
  const owner = config.envs[ownerScopeId];
  const environmentId = reference.environment ?? owner.environmentId;
  const targetId = reference.targetId ?? owner.targetId;
  const scopeId = buildScopeId(environmentId, targetId);
  if (!config.envs[scopeId]) {
    throw new Error(
      `Output reference '${reference.id}' selects unknown scope '${environmentId}'/'${targetId}'.`,
    );
  }
  return scopeId;
}

function emitOutputReferencePrelude(
  references: LinkReference[],
  bundleMap: Map<string, BundleTarget>,
  envId: string,
  fromFileName: string,
  assetFileNames: Map<string, string>,
  stylesByBundle: Map<string, string[]>,
  pendingFiles: PendingEmitFile[],
  rootURL = "/",
  config?: InternalBundlerConfig,
  conditionOptionSet?: OptionSet,
): string {
  const pendingOutputs = collectPendingLogicalOutputs(pendingFiles);
  return references
    .filter(
      (
        reference,
      ): reference is Extract<LinkReference, { kind: "output-url" }> & {
        symbol: string;
      } =>
        reference.kind === "output-url" &&
        reference.usage !== "css-variable" &&
        typeof reference.symbol === "string",
    )
    .map((reference) => {
      let fileNames: string[] | undefined;
      let relative = false;
      let entryExports = false;
      if (reference.outputType === "script") {
        const referenceScopeId = config
          ? resolveReferenceScopeId(reference, envId, config)
          : envId;
        const bundleTarget = bundleMap.get(
          `${referenceScopeId}:${reference.outputId}`,
        );
        entryExports = bundleTarget?.exportMode === "entry";
        fileNames = bundleTarget
          ? [
              bundleTarget.fileName,
              ...(reference.includeDependencies
                ? (bundleTarget.dependencyFileNames ?? [])
                : []),
            ]
          : undefined;
        if (
          conditionOptionSet &&
          conditionOptionSet.conditions.length > 0 &&
          config?.envs[referenceScopeId]?.platform === "browser"
        ) {
          fileNames = fileNames?.map((fileName) =>
            withConditionIdPlaceholder(fileName, conditionOptionSet),
          );
        }
        relative = reference.urlMode !== "public";
      } else if (reference.outputType === "style") {
        const referenceScopeId = config
          ? resolveReferenceScopeId(reference, envId, config)
          : envId;
        const styles =
          stylesByBundle.get(`${referenceScopeId}:${reference.outputId}`) ?? [];
        if (styles.length > 1) {
          throw new Error(
            `Logical style output '${reference.outputId}' resolves to multiple files.`,
          );
        }
        fileNames = styles[0] ? [styles[0]] : [];
        relative = true;
      } else {
        const fileName =
          assetFileNames.get(reference.outputId) ??
          pendingOutputs.get(reference.outputId)?.fileName;
        fileNames = fileName ? [fileName] : [];
        relative =
          reference.urlMode === "module-relative" ||
          (reference.urlMode !== "public" &&
            !assetFileNames.has(reference.outputId));
      }
      if (!fileNames || fileNames.length === 0) {
        throw new Error(
          `Missing logical output '${reference.outputId}' for reference '${reference.id}'.`,
        );
      }
      if (reference.includeDependencies && reference.outputType !== "script") {
        throw new Error(
          `Logical output '${reference.outputId}' cannot expose a dependency closure for type '${reference.outputType}'.`,
        );
      }
      const values = fileNames.map((fileName) =>
        relative
          ? `new URL(${JSON.stringify(relativeOutputSpecifier(fromFileName, fileName))}, import.meta.url).href`
          : JSON.stringify(joinRootURL(rootURL, fileName)),
      );
      const value = reference.includeDependencies
        ? `[${values.join(", ")}]`
        : values[0];
      return [
        `const ${reference.symbol} = ${value};`,
        reference.includeDependencies && entryExports
          ? `Object.defineProperty(${reference.symbol}, "__bundlerEntryExports", { value: true });`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function collectStaticDependencyFileNames(
  physicalPlan: PhysicalBundlePlan,
  physicalBundleIdByEntrypoint: Map<string, string>,
  bundleOutputs: Map<string, PhysicalBundleOutput>,
): string[] {
  const names: string[] = [];
  const visited = new Set<string>([physicalPlan.id]);
  const visit = (current: PhysicalBundlePlan): void => {
    for (const item of current.plan.staticImports) {
      const dependencyId = physicalBundleIdByEntrypoint.get(
        `${current.plan.envId}:${item.entryId}`,
      );
      if (!dependencyId || visited.has(dependencyId)) continue;
      visited.add(dependencyId);
      const dependency = bundleOutputs.get(dependencyId);
      if (!dependency) {
        throw new Error(
          `Missing finalized static dependency '${item.entryId}' for '${current.plan.entryId}'.`,
        );
      }
      names.push(dependency.fileName);
      visit(dependency.plan);
    }
  };
  visit(physicalPlan);
  return names;
}

function relativeOutputSpecifier(
  fromFileName: string,
  targetFileName: string,
): string {
  const relative = normalizePosixPath(
    path.posix.relative(path.posix.dirname(fromFileName), targetFileName),
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function collectPendingLogicalOutputs(
  files: PendingEmitFile[],
): Map<string, { fileName: string; contentHash: string }> {
  const outputs = new Map<string, { fileName: string; contentHash: string }>();
  for (const file of files) {
    if (!file.outputId) continue;
    const next = {
      fileName: finalPendingFileName(file),
      contentHash: contentHash(file.contents),
    };
    const existing = outputs.get(file.outputId);
    if (
      existing &&
      (existing.fileName !== next.fileName ||
        existing.contentHash !== next.contentHash)
    ) {
      throw new Error(`Conflicting logical output '${file.outputId}'.`);
    }
    outputs.set(file.outputId, next);
  }
  return outputs;
}

async function collectStaticAssetOutputs(
  fileRecords: FileRecord[],
  config: InternalBundlerConfig,
  usedAssetIds?: Set<string>,
): Promise<StaticAssetOutput[]> {
  const outputs = new Map<string, StaticAssetOutput>();
  for (const fileRecord of fileRecords) {
    const output = fileRecord.extraOutputs?.["bundler-asset"];
    if (!output) {
      continue;
    }
    const metadata = output.metadata as
      | {
          assetId?: string;
          sourceFileName?: string;
          extension?: string;
        }
      | undefined;
    if (!metadata?.assetId || !metadata.sourceFileName) {
      throw new Error(
        `Malformed static asset metadata for '${fileRecord.id}'.`,
      );
    }
    if (usedAssetIds && !usedAssetIds.has(metadata.assetId)) {
      continue;
    }
    const contents = await readExtraOutputContents(output);
    const next = createStaticAssetOutput(
      metadata.assetId,
      metadata.sourceFileName,
      contents,
      config,
      metadata.extension,
    );
    const existing = outputs.get(metadata.assetId);
    if (existing && contentHash(existing.contents) !== contentHash(contents)) {
      throw new Error(
        `Asset identity '${metadata.assetId}' resolved to different contents.`,
      );
    }
    outputs.set(metadata.assetId, next);
  }
  return Array.from(outputs.values()).sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  );
}

async function collectDeclaredExtraOutputs(
  fileRecords: FileRecord[],
  assetFileNames: Map<string, string>,
  config: InternalBundlerConfig,
): Promise<PendingEmitFile[]> {
  const declarations: Array<{
    output: NonNullable<FileRecord["extraOutputs"]>[string];
    file: PendingEmitFile;
  }> = [];
  for (const fileRecord of fileRecords) {
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      if (!output.outputId || !output.fileName) continue;
      const contents = await readExtraOutputContents(output);
      const type =
        output.type === "document" ||
        output.type === "manifest" ||
        output.type === "style" ||
        output.type === "source-map"
          ? output.type
          : "asset";
      declarations.push({
        output,
        file: {
          outputId: output.outputId,
          fileName: output.fileName,
          contents,
          type,
          contentType: output.contentType,
        },
      });
    }
  }
  const files = declarations.map((declaration) => declaration.file);
  const declaredOutputs = collectPendingLogicalOutputs(files);
  assertAcyclicDeclaredOutputs(declarations, declaredOutputs);
  for (const declaration of declarations) {
    const template = declaration.output.template;
    if (!template) continue;
    const references = new Map(
      template.references.map((reference) => [reference.id, reference]),
    );
    declaration.file.contents = Buffer.from(
      template.parts
        .map((part) => {
          if (part.kind === "text") return part.value;
          const reference = references.get(part.referenceId);
          if (!reference) {
            throw new Error(
              `Missing resource reference '${part.referenceId}' in logical output '${declaration.file.outputId}'.`,
            );
          }
          const value = resolveDeclaredOutputReference(
            reference,
            declaration.file.fileName,
            declaredOutputs,
            assetFileNames,
            config,
          );
          return encodeTemplateReference(value, part.encoding);
        })
        .join(""),
    );
  }
  collectPendingLogicalOutputs(files);
  return files;
}

function resolveDeclaredOutputReference(
  reference: LinkReference,
  fromFileName: string,
  declaredOutputs: Map<string, { fileName: string; contentHash: string }>,
  assetFileNames: Map<string, string>,
  config: InternalBundlerConfig,
): string {
  const outputId =
    reference.kind === "asset-url"
      ? reference.assetId
      : reference.kind === "output-url"
        ? reference.outputId
        : undefined;
  if (!outputId) {
    throw new Error(
      `Reference '${reference.id}' cannot be used in a declared logical output.`,
    );
  }
  const assetFileName = assetFileNames.get(outputId);
  if (assetFileName) {
    return joinRootURL(config.outputs.rootURL ?? "/", assetFileName);
  }
  const declared = declaredOutputs.get(outputId);
  if (declared) {
    return relativeOutputSpecifier(fromFileName, declared.fileName);
  }
  throw new Error(
    `Missing logical output '${outputId}' for reference '${reference.id}'.`,
  );
}

function assertAcyclicDeclaredOutputs(
  declarations: Array<{
    output: NonNullable<FileRecord["extraOutputs"]>[string];
    file: PendingEmitFile;
  }>,
  declaredOutputs: Map<string, { fileName: string; contentHash: string }>,
): void {
  const dependencies = new Map<string, Set<string>>();
  for (const declaration of declarations) {
    const outputId = declaration.file.outputId;
    if (!outputId) continue;
    const targets = dependencies.get(outputId) ?? new Set<string>();
    for (const reference of declaration.output.template?.references ?? []) {
      if (
        reference.kind === "output-url" &&
        declaredOutputs.has(reference.outputId)
      ) {
        targets.add(reference.outputId);
      }
    }
    dependencies.set(outputId, targets);
  }
  assertAcyclicOutputGraph(dependencies);
}

function collectUsedAssetIds(
  plans: BundlePlan[],
  fileRecords: FileRecord[],
  documents: DocumentPlan[],
): Set<string> {
  const used = new Set<string>();
  const selectedModules = new Set(plans.flatMap((plan) => plan.modules));
  for (const plan of plans) {
    for (const reference of dedupeBundleReferences(plan.parts)) {
      if (reference.kind === "asset-url") used.add(reference.assetId);
      if (reference.kind === "output-url" && reference.outputType === "asset") {
        used.add(reference.outputId);
      }
    }
  }
  for (const fileRecord of fileRecords) {
    if (!selectedModules.has(fileRecord.id)) continue;
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      for (const reference of output.template?.references ?? []) {
        if (reference.kind === "asset-url") used.add(reference.assetId);
        if (
          reference.kind === "output-url" &&
          reference.outputType === "asset"
        ) {
          used.add(reference.outputId);
        }
      }
    }
  }
  for (const document of documents) {
    for (const reference of document.result.references) {
      if (reference.kind === "asset-url") used.add(reference.assetId);
      if (reference.kind === "output-url" && reference.outputType === "asset") {
        used.add(reference.outputId);
      }
    }
  }
  return used;
}

function createStaticAssetOutput(
  assetId: string,
  sourceFileName: string,
  contents: Uint8Array,
  config: InternalBundlerConfig,
  suppliedExtension?: string,
): StaticAssetOutput {
  const hash = contentHashShort(contents);
  const extension = suppliedExtension ?? path.extname(sourceFileName);
  const baseName = path.basename(sourceFileName, path.extname(sourceFileName));
  const pattern = config.outputs.assetFileName ?? "assets/[name].[hash][ext]";
  const fileName = normalizePosixPath(
    pattern
      .replaceAll("[name]", baseName)
      .replaceAll("[hash]", hash)
      .replaceAll("[ext]", extension),
  );
  return {
    assetId,
    fileName,
    contents,
    contentType: guessContentType(fileName),
  };
}

function dedupeStaticAssets(assets: StaticAssetOutput[]): StaticAssetOutput[] {
  const deduped = new Map<string, StaticAssetOutput>();
  for (const asset of assets) {
    const existing = deduped.get(asset.assetId);
    if (
      existing &&
      contentHash(existing.contents) !== contentHash(asset.contents)
    ) {
      throw new Error(
        `Asset identity '${asset.assetId}' resolved to different contents.`,
      );
    }
    deduped.set(asset.assetId, asset);
  }
  return Array.from(deduped.values()).sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  );
}

async function readExtraOutputContents(
  output: NonNullable<FileRecord["extraOutputs"]>[string],
): Promise<Uint8Array> {
  if (typeof output.contents === "string") {
    return Buffer.from(output.contents);
  }
  if (output.contents) {
    return output.contents;
  }
  if (output.artifactPath) {
    return fs.readFile(output.artifactPath);
  }
  throw new Error("Resource output has no contents or artifact path.");
}

function findCellProvidingSymbol(
  node: ModuleNode,
  symbol: string,
): CellRecord | undefined {
  return getAllCells(node).find((cell) => cell.provides.includes(symbol));
}

function emitBundleExports(
  node: ModuleNode | undefined,
  entryKind: BundleEntryKind,
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
    if (hmr || entryKind !== "explicit") {
      addExport(provider.symbol, provider.symbol);
    }
    if (entryKind === "explicit") {
      addExport(provider.symbol, exported);
    }
  }
  if (entryKind === "dynamic" && node) {
    addExport(`__NS__${node.prefix}`, `__NS__${node.prefix}`);
  }
  for (const symbol of Array.from(internalSymbols).sort()) {
    addExport(internalAliases.get(symbol) ?? symbol, symbol);
  }

  return specifiers.length > 0 ? `export { ${specifiers.join(", ")} };` : "";
}

function fromBundleDraft(draft: BundlePlanDraftWithHmr): BundlePlan {
  const entryKind =
    draft.entryKind ??
    (draft.entryId.startsWith("bundler:manual:")
      ? "manual"
      : draft.entryId.startsWith("bundler:")
        ? "shared"
        : draft.exportMode === "dynamic"
          ? "dynamic"
          : "explicit");
  return {
    envId: draft.envId,
    entryId: draft.entryId,
    entryKind,
    exportMode: entryKind === "explicit" ? "entry" : "dynamic",
    entrypoints: [
      {
        envId: draft.envId,
        entryId: draft.entryId,
        entryKind,
        exportMode: entryKind === "explicit" ? "entry" : "dynamic",
      },
    ],
    parts: draft.orderedParts,
    staticImports: draft.staticImports ?? [],
    diagnostics: draft.diagnostics,
    modules: draft.modules,
    conditions: draft.conditions,
    conditionNames: draft.conditionNames,
    hmr: draft.hmr,
  };
}

function flushPendingFiles(
  files: PendingEmitFile[],
  manifest: BundleManifest,
  outputRegistry: OutputRegistry,
): void {
  for (const file of files) {
    const finalName = finalPendingFileName(file);
    outputRegistry.add(
      finalName,
      file.contents,
      `emitted:${file.outputId ?? file.bundleKey ?? file.pluginName ?? file.type ?? "file"}:${file.fileName}`,
    );
    const bundleKey =
      file.type === "style"
        ? stableManifestBundleKey(manifest, file.bundleKey)
        : file.bundleKey;
    manifest.emittedFiles.push({
      fileName: finalName,
      originalFileName: file.fileName,
      type: file.type ?? "asset",
      envId: file.envId,
      contentType: file.contentType,
      bundleKey,
      contentHash: contentHash(file.contents),
      global: file.global,
    });
    manifest.assets?.push({
      fileName: finalName,
      type:
        file.type === "manifest"
          ? "manifest"
          : file.type === "document"
            ? "document"
            : file.type === "style"
              ? "style"
              : file.type === "source-map"
                ? "source-map"
                : "asset",
      contentType: file.contentType ?? guessContentType(finalName),
      envId: file.envId,
      bundleKey,
      global: file.global,
    });
  }
}

function finalPendingFileName(file: PendingEmitFile): string {
  return file.hash
    ? applyHashToFileName(file.fileName, file.contents)
    : file.fileName;
}

function stableManifestBundleKey(
  manifest: BundleManifest,
  bundleKey: string | undefined,
): string | undefined {
  if (!bundleKey) return bundleKey;
  const bundle = manifest.bundles.find(
    (candidate) => candidate.id === bundleKey,
  );
  if (!bundle) return bundleKey;
  const logicalEntrypoints = bundle.entrypoints
    .map((entrypoint) => `${entrypoint.envId}:${entrypoint.entryId}`)
    .sort();
  if (logicalEntrypoints.length > 0) {
    return logicalEntrypoints.join("|");
  }
  return `${bundle.envId}:${bundle.entryId}`;
}

function applyHashToFileName(
  fileName: string,
  contents: string | Uint8Array,
): string {
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
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".wasm":
      return "application/wasm";
    case ".pdf":
      return "application/pdf";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
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
