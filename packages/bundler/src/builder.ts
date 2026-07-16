import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import { joinRootURL, resolveRootURL } from "./output-url.js";
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
} from "./plugins/run.js";
import type { BundlerConfig, EntrySpec } from "./config.js";
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
  /** Development-only HMR state. This is intentionally not serialized. */
  hmr?: HmrBuildState;
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
};

type ModuleCollection = {
  headersByEnv: Map<string, Map<string, FileRecord>>;
  dynamicEntries: EntrySpec[];
  resolvedMap: Map<string, ModuleResolution>;
  fileRecords: FileRecord[];
};

type ScheduledModule = {
  id: string;
  moduleIdentity: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  envId: string;
  type: ModuleResolution["type"];
  intent: ModuleResolution["intent"];
  canonicalPath: string;
  meta?: Record<string, unknown>;
  source?: string;
  sourceMap?: string;
  resolveFrom?: string;
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
  config: BundlerConfig,
  plugins: BundlerPlugin[],
): Promise<BuildResult> {
  config = {
    ...config,
    outputs: {
      ...config.outputs,
      rootURL: resolveRootURL(config.outputs),
    },
  };
  validateTransformConfig(config);
  const buildMode = resolveBuildMode();
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
  const debugOutputDir = await prepareDebugOutput(config, cacheBaseDir);
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
    const prepared = await prepareDocumentEntries(
      explicitEntries,
      normalizedPlugins,
      config,
      cacheBaseDir,
      workerProfile.fingerprint,
      buildMode,
    );
    explicitEntries.splice(0, explicitEntries.length, ...prepared.entries);
    const devOptions = await resolveDevOptions(config, explicitEntries);
    const cacheRoot = await prepareCacheRoot(
      cacheBaseDir,
      config,
      explicitEntries,
      workerProfile,
      userPlugins,
      buildMode,
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
        buildMode,
        pool,
        resolver,
        debugOutputDir,
      );
    const graphs = await Promise.all(
      envs.map((envId) =>
        buildGraph({
          envId,
          headers: Array.from(headersByEnv.get(envId)?.values() ?? []),
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
      drafts = drafts.map((draft) =>
        prependLinkReferencePrelude(draft, config.envs[graph.envId].target),
      );
      bundlePlans.push(...drafts.map((draft) => fromBundleDraft(draft)));
    }

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
    const bundleKeysWithCss = collectBundleKeysWithCss(
      bundlePlans,
      fileRecords,
    );

    const bundleMap = new Map<string, BundleTarget>();
    const bundleOutputs = new Map<
      string,
      { envId: string; entryId: string; fileName: string; modules: string[] }
    >();
    for (const plan of bundlePlans) {
      const assembled = assembleBundle(plan.parts);
      const references = dedupeBundleReferences(plan.parts);
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
      plan.parts = [
        {
          code: finalBundle.code,
          map: finalBundle.map,
          references,
        },
      ];
      const linkedAssetFileNames = references
        .filter(
          (
            reference,
          ): reference is Extract<LinkReference, { kind: "asset-url" }> =>
            reference.kind === "asset-url",
        )
        .map((reference) => staticAssetFileNames.get(reference.assetId))
        .filter((fileName): fileName is string => Boolean(fileName))
        .sort();
      const linksDynamicCss = plan.dynamicImports.some(
        (dependency) =>
          dependency.resolvedId != null &&
          bundleKeysWithCss.has(`${plan.envId}:${dependency.resolvedId}`),
      );
      const linksRootURL = linkedAssetFileNames.length > 0 || linksDynamicCss;
      const hash = contentHashShort(
        linksRootURL
          ? JSON.stringify({
              code: finalBundle.code,
              assets: linkedAssetFileNames,
              rootURL: config.outputs.rootURL,
            })
          : finalBundle.code,
      );
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

    const resolveReference = createReferenceResolver(
      fileRecords,
      staticAssetFileNames,
      config,
    );
    await runGenerateBundleResources(normalizedPlugins, {
      bundles: Array.from(bundleOutputs.values()),
      modules: fileRecords,
      outputs: config.outputs,
      resolveReference,
      emitFile(file) {
        pendingFiles.push(file);
      },
    });
    const stylesByBundle = collectStylesByBundle(bundlePlans, pendingFiles);
    const documentStyleOutputs = createDocumentStyleOutputs(
      prepared.documents,
      stylesByBundle,
      pendingFiles,
      config,
    );

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
        emitDynamicImportConstants(
          plan.dynamicImports,
          bundleMap,
          plan.envId,
          stylesByBundle,
          config.outputs.rootURL,
        ),
        emitAssetReferencePrelude(
          dedupeBundleReferences(plan.parts),
          staticAssetFileNames,
          config.outputs.rootURL,
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
        bundleDependencies: Object.fromEntries(
          bundlePlans.map((plan) => [
            `${plan.envId}:${plan.entryId}`,
            plan.staticImports.map((item) => `${plan.envId}:${item.entryId}`),
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
    await flushPendingFiles(config.outputs.outDir, pendingFiles, manifest);
    pendingFiles.length = 0;
    await emitDocuments(
      prepared.documents,
      manifest,
      staticAssetFileNames,
      config,
      pendingFiles,
      stylesByBundle,
      documentStyleOutputs,
    );
    await flushPendingFiles(config.outputs.outDir, pendingFiles, manifest);
    if (config.outputs.manifestFile) {
      await fs.writeFile(
        path.join(config.outputs.outDir, config.outputs.manifestFile),
        JSON.stringify(manifest, null, 2),
        "utf8",
      );
    }

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
        }
      : undefined;

    return {
      bundles,
      manifest,
      hmr,
      diagnostics,
    };
  } finally {
    await cleanup();
  }
}

async function prepareDocumentEntries(
  entries: EntrySpec[],
  plugins: NormalizedPlugin[],
  config: BundlerConfig,
  cacheBaseDir: string,
  workerFingerprint: string,
  buildMode: string,
): Promise<{
  entries: EntrySpec[];
  documents: DocumentPlan[];
  assets: StaticAssetOutput[];
}> {
  const scriptEntries: EntrySpec[] = [];
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
          format: 2,
          documentIdentity,
          sourceHash: contentHash(source),
          envId,
          target: env.target,
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
          (await runTransformDocument(plugins, envId, {
            id: entry.id,
            filePath,
            envId,
            target: env.target,
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

function dedupeEntries(entries: EntrySpec[]): EntrySpec[] {
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
  config: BundlerConfig,
  pendingFiles: PendingEmitFile[],
  stylesByBundle: Map<string, string[]>,
  documentStyleOutputs: Map<string, string>,
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
        if (reference.kind === "asset-url") {
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
            const bundle = manifest.bundles.find(
              (item) =>
                item.envId === document.envId &&
                item.entryId === reference.outputId,
            );
            if (!bundle) {
              throw new Error(
                `Missing script output '${reference.outputId}' for HTML entry.`,
              );
            }
            target = bundle.fileName;
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
          const contents = await fs.readFile(
            path.join(config.outputs.outDir, target),
          );
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
    manifest.documents.push({
      envId: document.envId,
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
  config: BundlerConfig,
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
      const pattern = config.outputs.cssFileName ?? "[entry].[env].[hash].css";
      const provisional = normalizePosixPath(
        pattern
          .replaceAll("[entry]", sanitizeOutputName(reference.outputId))
          .replaceAll("[env]", document.envId)
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
  const entries: Array<[string, LinkReference]> = [];
  for (const fileRecord of fileRecords) {
    for (const reference of fileRecord.linkReferences ?? []) {
      entries.push([reference.id, reference]);
    }
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      for (const reference of output.template?.references ?? []) {
        entries.push([reference.id, reference]);
      }
    }
  }
  return new Map(entries);
}

function createReferenceResolver(
  fileRecords: FileRecord[],
  assetFileNames: Map<string, string>,
  config: BundlerConfig,
): (referenceId: string, fromFileName: string) => string {
  const references = collectFileReferences(fileRecords);
  return (referenceId) => {
    const reference = references.get(referenceId);
    if (!reference || reference.kind !== "asset-url") {
      throw new Error(`Unknown asset reference '${referenceId}'.`);
    }
    const fileName = assetFileNames.get(reference.assetId);
    if (!fileName) {
      throw new Error(`Missing emitted asset '${reference.assetId}'.`);
    }
    return joinRootURL(config.outputs.rootURL ?? "/", fileName);
  };
}

function collectStylesByBundle(
  bundlePlans: BundlePlan[],
  files: PendingEmitFile[],
): Map<string, string[]> {
  const direct = new Map<string, string[]>();
  for (const file of files) {
    if (file.type !== "style" || !file.bundleKey) {
      continue;
    }
    const names = direct.get(file.bundleKey) ?? [];
    names.push(file.fileName);
    direct.set(file.bundleKey, names);
  }
  const plans = new Map(
    bundlePlans.map((plan) => [`${plan.envId}:${plan.entryId}`, plan]),
  );
  const output = new Map<string, string[]>();
  const collect = (key: string, visiting = new Set<string>()): string[] => {
    const cached = output.get(key);
    if (cached) return cached;
    if (visiting.has(key)) return [];
    visiting.add(key);
    const plan = plans.get(key);
    const names = [
      ...(plan?.staticImports.flatMap((dependency) =>
        collect(`${plan.envId}:${dependency.entryId}`, visiting),
      ) ?? []),
      ...(direct.get(key) ?? []),
    ];
    visiting.delete(key);
    const deduped = Array.from(new Set(names));
    output.set(key, deduped);
    return deduped;
  };
  for (const key of plans.keys()) collect(key);
  return output;
}

function collectBundleKeysWithCss(
  bundlePlans: BundlePlan[],
  fileRecords: FileRecord[],
): Set<string> {
  const cssModules = new Set(
    fileRecords.flatMap((record) => {
      if (!record.extraOutputs?.["bundler-css"]) return [];
      return record.envs.flatMap((envId) => [
        `${envId}:${record.id}`,
        ...(record.moduleIdentity ? [`${envId}:${record.moduleIdentity}`] : []),
      ]);
    }),
  );
  const plans = new Map(
    bundlePlans.map((plan) => [`${plan.envId}:${plan.entryId}`, plan]),
  );
  const result = new Set<string>();
  const inspected = new Set<string>();
  const includesCss = (key: string, visiting = new Set<string>()): boolean => {
    if (result.has(key)) return true;
    if (inspected.has(key) || visiting.has(key)) return false;
    visiting.add(key);
    const plan = plans.get(key);
    const found =
      plan?.modules.some((moduleId) =>
        cssModules.has(`${plan.envId}:${moduleId}`),
      ) ||
      plan?.staticImports.some((dependency) =>
        includesCss(`${plan.envId}:${dependency.entryId}`, visiting),
      ) ||
      false;
    visiting.delete(key);
    inspected.add(key);
    if (found) result.add(key);
    return found;
  };
  for (const key of plans.keys()) includesCss(key);
  return result;
}

async function prepareCacheRoot(
  cacheBaseDir: string,
  config: BundlerConfig,
  entries: EntrySpec[],
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

  return {
    activeRoot,
    configHash,
    remote: config.cache?.remote || undefined,
  };
}

function normalizeConfigForCache(
  config: BundlerConfig,
  entries: EntrySpec[],
  workerProfile: WorkerTransformProfile,
  plugins: BundlerPlugin[],
  buildMode: string,
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
      id: serializeConfigValue(entry.id),
      path: portableCachePathIdentity(entry.path),
      envs: entry.envs ? [...entry.envs] : undefined,
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
    buildMode,
    transforms: serializeConfigValue(config.transforms),
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

function inferEntryModuleType(
  entry: EntrySpec,
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
  if (/\.(?:[cm]?js|jsx|tsx?|mts|cts)$/.test(lower)) return "javascript";
  return "asset";
}

function resolveJsLikeSyntax(
  config: BundlerConfig,
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
  config: BundlerConfig,
): Record<string, unknown> {
  const defaults: Record<string, { jsx?: boolean; typescript?: boolean }> = {
    ".js": {},
    ".mjs": {},
    ".cjs": {},
    ".jsx": { jsx: true },
    ".ts": { typescript: true },
    ".tsx": { jsx: true, typescript: true },
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

function validateTransformConfig(config: BundlerConfig): void {
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

function pickEntriesForEnv(entries: EntrySpec[], envId: string): EntrySpec[] {
  return entries.filter((entry) => !entry.envs || entry.envs.includes(envId));
}

function createBuiltinPlugins(config: BundlerConfig): BundlerPlugin[] {
  const plugins: BundlerPlugin[] = [
    {
      __bundlerPluginRef: true,
      module: fileURLToPath(
        new URL("../../html-plugin/bundler.mjs", import.meta.url),
      ),
    },
    {
      __bundlerPluginRef: true,
      module: fileURLToPath(
        new URL("../../static-assets/bundler.mjs", import.meta.url),
      ),
    },
    {
      __bundlerPluginRef: true,
      module: fileURLToPath(
        new URL("../../module-paths/bundler.mjs", import.meta.url),
      ),
    },
  ];
  const cssTransformer =
    config.css === false ? false : (config.transforms?.css ?? "lightningcss");
  if (cssTransformer !== false) {
    const sourceMaps = resolveSourceMapOutput(config.outputs.sourceMap);
    plugins.push({
      __bundlerPluginRef: true,
      module: fileURLToPath(
        new URL("../../css-plugin/bundler.mjs", import.meta.url),
      ),
      options: {
        sourceMaps: Boolean(sourceMaps),
        sourcesContent: sourceMaps?.sourcesContent ?? false,
      },
    });
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
      const sharedEntryId = createSharedBundleEntryId(graph.envId);
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

function createSharedBundleEntryId(envId: string): string {
  return `bundler:common:${envId}`;
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
      const resolvedId =
        dyn.target.kind === "file"
          ? (graph.moduleIdentities.get(dyn.target.moduleId) ??
            dyn.target.moduleId)
          : null;
      const targetNode = resolvedId ? graph.nodes.get(resolvedId) : undefined;
      dynamicImports.push({
        hashKey: dyn.hashKey,
        resolvedId,
        externalRequest:
          dyn.target.kind === "runtime" ? dyn.target.specifier : undefined,
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
  buildMode: string,
  pool: WorkerPool,
  resolver: Resolver,
  debugOutputDir: string | null,
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
      moduleIdentity: module.moduleIdentity,
      filePath: module.filePath,
      pkg: module.pkg,
      target: {
        kind: "file",
        moduleId: module.moduleIdentity,
        canonicalPath: module.canonicalPath,
      },
      type: module.type,
      intent: module.intent,
      meta: module.meta,
    });
    resolvedMap.set(module.moduleIdentity, {
      id: module.id,
      moduleIdentity: module.moduleIdentity,
      filePath: module.filePath,
      pkg: module.pkg,
      target: {
        kind: "file",
        moduleId: module.moduleIdentity,
        canonicalPath: module.canonicalPath,
      },
      type: module.type,
      intent: module.intent,
      meta: module.meta,
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
      buildMode,
      pool,
      resolver,
      debugOutputDir,
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
    const pkg = readPkgSafe(pkgRoot);
    const canonicalPath = packagePathIdentity(pkg, filePath);
    const type = inferEntryModuleType(entry, filePath);
    for (const envId of entry.envs ?? envs) {
      schedule({
        id: filePath,
        moduleIdentity: entry.moduleIdentity ?? canonicalPath,
        filePath,
        envId,
        pkg,
        type,
        intent: "module",
        canonicalPath,
        source: entry.source,
        sourceMap: entry.sourceMap,
        resolveFrom: entry.resolveFrom,
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
  buildMode: string,
  pool: WorkerPool,
  resolver: Resolver,
  debugOutputDir: string | null,
  headersByEnv: Map<string, Map<string, FileRecord>>,
  resolvedMap: Map<string, ModuleResolution>,
  dynamicEntries: Map<string, EntrySpec>,
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
    importIntent: module.intent,
    canonicalPath: module.canonicalPath,
    resolutionMeta: module.meta,
    buildMode,
    transformConfig: resolvedTransformConfig(config),
    pkg: module.pkg,
    envs,
    targets: Object.fromEntries(
      envs.map((envId) => [envId, config.envs[envId].target]),
    ),
    cacheDir,
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
    );
  })) as WorkerTransformResponse;
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
    fileRecords.push(fileRecord);

    if (fileRecord.flags.hasTopLevelAwait) {
      throw new Error(
        `E_TLA: Top-level 'await' is not supported (v1). at ${module.filePath}`,
      );
    }

    const { dependencies, dynamicEntries: discoveredDynamics } =
      await discoverModulesFromHeader(fileRecord, envId, resolver);
    for (const resolved of dependencies) {
      if (resolved.target.kind === "runtime") {
        continue;
      }
      resolvedMap.set(resolved.id, resolved);
      resolvedMap.set(resolved.moduleIdentity, resolved);
      schedule({
        id: resolved.id,
        moduleIdentity: resolved.moduleIdentity,
        filePath: resolved.filePath,
        envId,
        pkg: resolved.pkg,
        type: resolved.type,
        intent: resolved.intent,
        canonicalPath: resolved.target.canonicalPath,
        meta: resolved.meta,
      });
    }

    for (const dynamicEntry of discoveredDynamics) {
      resolvedMap.set(dynamicEntry.id, dynamicEntry);
      resolvedMap.set(dynamicEntry.moduleIdentity, dynamicEntry);
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
          moduleIdentity: dynamicEntry.moduleIdentity,
          filePath: dynamicEntry.filePath,
          envId: targetEnv,
          pkg: dynamicEntry.pkg,
          type: dynamicEntry.type,
          intent: dynamicEntry.intent,
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
): Promise<{
  dependencies: ModuleResolution[];
  dynamicEntries: DynamicEntryDiscovery[];
}> {
  const dependencyPromises: Array<Promise<ModuleResolution>> = [];
  const dynamicPromises: Array<Promise<DynamicEntryDiscovery>> = [];

  for (const importEntry of irHeader.imports) {
    if (importEntry.kind === "type" || importEntry.target.kind === "runtime") {
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
        irHeader.resolutionMeta,
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
        irHeader.resolutionMeta,
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
      resolver(
        irHeader.id,
        irHeader.filePath,
        reexport.request ?? reexport.source,
        envId,
        "reexport",
        undefined,
        irHeader.resolutionMeta,
      ),
    );
  }

  for (const dynamicImport of irHeader.dynamicImports) {
    if (dynamicImport.target.kind === "runtime") {
      continue;
    }
    dynamicPromises.push(
      resolver(
        irHeader.id,
        irHeader.filePath,
        dynamicImport.request ?? dynamicImport.source,
        envId,
        "dynamic-import",
        undefined,
        irHeader.resolutionMeta,
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
  config: BundlerConfig,
  cacheBaseDir: string,
): Promise<string | null> {
  if (
    config.debug !== undefined &&
    config.debug !== false &&
    config.debug !== true
  ) {
    throw new Error("Bundler debug must be a boolean.");
  }
  const debugOutputDir = path.join(
    findCacheContainer(cacheBaseDir),
    "__DEBUG__",
  );
  await fs.rm(debugOutputDir, { recursive: true, force: true });
  if (config.debug !== true) {
    return null;
  }
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
    : `intent-${debugPathSegment(module.intent)}`;
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
          intent: module.intent,
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
): Promise<
  Record<
    string,
    Record<
      string,
      {
        target: ModuleResolution["target"];
        type: ModuleResolution["type"];
        intent: ModuleResolution["intent"];
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
        intent: ModuleResolution["intent"];
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
          return [
            request.key,
            {
              target: resolved.target,
              type: resolved.type,
              intent: resolved.intent,
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
  return Array.from(
    new Map(
      parts
        .flatMap((part) => part.references ?? [])
        .map((reference) => [reference.id, reference]),
    ).values(),
  ).sort((left, right) => left.id.localeCompare(right.id));
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

async function collectStaticAssetOutputs(
  fileRecords: FileRecord[],
  config: BundlerConfig,
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
    }
  }
  for (const fileRecord of fileRecords) {
    if (!selectedModules.has(fileRecord.id)) continue;
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      for (const reference of output.template?.references ?? []) {
        if (reference.kind === "asset-url") used.add(reference.assetId);
      }
    }
  }
  for (const document of documents) {
    for (const reference of document.result.references) {
      if (reference.kind === "asset-url") used.add(reference.assetId);
    }
  }
  return used;
}

function createStaticAssetOutput(
  assetId: string,
  sourceFileName: string,
  contents: Uint8Array,
  config: BundlerConfig,
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
    await fs.mkdir(path.dirname(path.join(outDir, finalName)), {
      recursive: true,
    });
    await fs.writeFile(path.join(outDir, finalName), file.contents);
    manifest.emittedFiles.push({
      fileName: finalName,
      originalFileName: file.fileName,
      type: file.type ?? "asset",
      envId: file.envId,
      contentType: file.contentType,
      bundleKey: file.bundleKey,
      contentHash: contentHash(file.contents),
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
      bundleKey: file.bundleKey,
    });
  }
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
