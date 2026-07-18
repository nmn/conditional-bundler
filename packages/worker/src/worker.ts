import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import remappingModule from "@ampproject/remapping";
import { contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  CellRecord,
  DiscoveredEntrypoint,
  ExtraTransformOutput,
  FileRecord,
  LinkReference,
  ModuleVariantRecord,
  RemoteCacheAdapter,
  RemoteCacheConfig,
  TransformResult,
} from "@bundler/shared";
import {
  createRemoteCacheAdapter,
  joinRemoteKey,
  writeFileAtomic,
  writeJsonAtomic,
  ensureDir,
  readJsonIfExists,
  fileExists,
} from "@bundler/shared";

if (!parentPort) {
  throw new Error("Worker must be spawned with parentPort.");
}

type WorkerBabelPluginSpec = {
  modulePath: string;
  options?: Record<string, unknown>;
};

type WorkerScopedBabelPluginSpec = {
  plugin: WorkerBabelPluginSpec;
  environments?: "each" | string[];
  targets?: "each" | string[];
};

type WorkerPipelineBabelPluginSpec = {
  plugin: WorkerBabelPluginSpec;
  environmentScoped: boolean;
  targetScoped: boolean;
};

type WorkerTransformProfile = {
  fingerprint: string;
  transform: WorkerScopedBabelPluginSpec[];
  transformPre: WorkerScopedBabelPluginSpec[];
  transformFinalize: WorkerScopedBabelPluginSpec[];
  transformPost: WorkerScopedBabelPluginSpec[];
  representationTransforms: Record<string, WorkerBabelPluginSpec>;
};

type WorkerRequest = {
  id: string;
  moduleIdentity: string;
  realPath: string;
  code: string;
  sourceBytes?: Uint8Array;
  moduleType?: "javascript" | "css" | "asset";
  importRepresentation?: string;
  canonicalPath?: string;
  resolutionMeta?: Record<string, unknown>;
  buildMode?: string;
  transformConfig?: Record<string, unknown>;
  pkg: { name: string; version: string; root: string };
  /** Concrete environment/target scope ids processed by this request. */
  envs: string[];
  allEnvIds?: string[];
  environments: Record<string, string>;
  targetIds: Record<string, string>;
  targets: Record<string, "node" | "browser">;
  defines: Record<string, Record<string, string | number | boolean | null>>;
  cacheDir: string;
  sharedCacheDir: string;
  cacheNamespace?: string;
  remoteCache?: RemoteCacheConfig;
  syntax: { jsx: boolean; ts: boolean };
  codeByEnv?: Record<string, string>;
  mapByEnv?: Record<string, string>;
  sourceMap?: {
    sourceFileName: string;
    outputDir: string;
    sourcesContent: boolean;
  };
  discoveredEntrypointsByEnv?: Record<string, DiscoveredEntrypoint[]>;
  extraOutputsByEnv?: Record<string, Record<string, ExtraTransformOutput>>;
  linkReferencesByEnv?: Record<string, LinkReference[]>;
  workerProfile: WorkerTransformProfile;
  dev?: {
    hmr?: boolean;
  };
};

type WorkerResponse = {
  ok: boolean;
  cacheHit?: boolean;
  contentHash: string;
  prefix: string;
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

type ResolvedImportsByEnv = Record<
  string,
  Record<
    string,
    {
      target:
        | { kind: "file"; moduleId: string; canonicalPath: string }
        | { kind: "runtime"; specifier: string };
      type: "javascript" | "css" | "asset";
      representation?: string;
      meta?: Record<string, unknown>;
    }
  >
>;

type CoordinatorResponseMessage = {
  type: "coordinator-response";
  requestId: number;
  payload?: unknown;
  error?: string;
};

type ModuleCacheRecord = {
  baseKey: string;
  moduleKey: string;
  dependencyRequestsByEnv: Record<string, WorkerImportRequest[]>;
  variants?: ModuleVariantRecord[];
  fileRecordsByEnv: Record<string, FileRecord>;
};

type TransformFileOutput = {
  resultsByEnv: Record<string, TransformResult>;
  dependencyRequestsByEnv: Record<string, WorkerImportRequest[]>;
  resolvedImportsByEnv: ResolvedImportsByEnv;
};

type FileCachePaths = {
  fileHash: string;
  fileDir: string;
  artifactDir: string;
  modulePath: string;
  remoteBaseKey: string;
  remoteArtifactBaseKey: string;
};

const babelModuleCache = new Map<string, unknown>();
const representationTransformCache = new Map<
  string,
  (
    context: WorkerRepresentationTransformContext,
    options: Record<string, unknown>,
  ) =>
    | Promise<WorkerRepresentationTransformResult>
    | WorkerRepresentationTransformResult
>();
const pendingCoordinatorRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let nextCoordinatorRequestId = 1;
const CELL_ARTIFACT_FORMAT = 32;
const remapping = ((
  remappingModule as unknown as {
    default?: typeof import("@ampproject/remapping").default;
  }
).default ??
  remappingModule) as unknown as typeof import("@ampproject/remapping").default;

async function handleTransform(
  request: WorkerRequest,
): Promise<WorkerResponse> {
  const baseKey = buildBaseModuleKey(request);
  const sourceContent = request.sourceBytes ?? request.code;
  const fileHash = contentHash(sourceContent);
  const cachePaths = buildFileCachePaths(
    request.cacheDir,
    request.canonicalPath ?? request.moduleIdentity,
    baseKey,
  );
  const remote = createRemoteCacheAdapter(
    request.remoteCache,
    request.cacheNamespace,
  );
  const cached = await readModuleCache(cachePaths.modulePath);
  const hydratedCached = cached
    ? {
        ...cached,
        fileRecordsByEnv: hydrateCachedFileRecords(
          cached.fileRecordsByEnv,
          cachePaths.fileDir,
          request,
        ),
      }
    : null;
  const validatedCached = hydratedCached
    ? await validateCacheCandidate(hydratedCached, request, baseKey)
    : null;
  if (
    validatedCached &&
    (await hasCachedArtifacts(validatedCached.fileRecordsByEnv))
  ) {
    const first = Object.values(validatedCached.fileRecordsByEnv)[0];
    return {
      ok: true,
      cacheHit: true,
      contentHash: first.contentHash,
      prefix: first.prefix,
      variants: collectVariants(validatedCached.fileRecordsByEnv),
      fileRecordsByEnv: validatedCached.fileRecordsByEnv,
    };
  }
  const remoteCached = remote
    ? await readRemoteModuleCache(remote, cachePaths, baseKey, request)
    : null;
  if (remoteCached) {
    const first = Object.values(remoteCached.fileRecordsByEnv)[0];
    return {
      ok: true,
      cacheHit: true,
      contentHash: first.contentHash,
      prefix: first.prefix,
      variants: collectVariants(remoteCached.fileRecordsByEnv),
      fileRecordsByEnv: remoteCached.fileRecordsByEnv,
    };
  }

  const transformed = await transformFile(request);
  const resultsByEnv = transformed.resultsByEnv;
  const moduleKey = buildModuleKey(baseKey, transformed.resolvedImportsByEnv);
  const variants: ModuleVariantRecord[] = groupTransformResults(
    resultsByEnv,
  ).map(({ variantId, environmentIds, result }) => {
    if (!result.fileRecord) {
      throw new Error(
        `Transform result missing file record for variant '${variantId}'.`,
      );
    }
    const representativeEnv = environmentIds[0];
    const environment = request.environments[representativeEnv];
    const targetIds = Array.from(
      new Set(environmentIds.map((scopeId) => request.targetIds[scopeId])),
    ).sort();
    const record = finalizeFileRecord(
      {
        ...result.fileRecord,
        id: request.id,
        filePath: request.realPath,
        prefix: result.fileRecord.prefix,
        contentHash: contentHash(
          request.codeByEnv?.[representativeEnv] ?? sourceContent,
        ),
        variantId,
        environment,
        targetIds,
        environmentIds,
        envs: environmentIds,
        codeByEnv: {},
        mapByEnv: {},
        pkg: request.pkg,
        resolutionMeta: request.resolutionMeta,
      },
      cachePaths.artifactDir,
      variantId,
    );
    return { variantId, environment, targetIds, environmentIds, record };
  });
  const fileRecordsByEnv = Object.fromEntries(
    variants.flatMap((variant) =>
      variant.environmentIds.map((envId) => [envId, variant.record]),
    ),
  ) as Record<string, FileRecord>;

  await writeFileCache(
    cachePaths,
    resultsByEnv,
    fileRecordsByEnv,
    moduleKey,
    baseKey,
    transformed.dependencyRequestsByEnv,
    request.moduleIdentity,
    variants,
  );
  if (remote) {
    await writeRemoteFileCache(
      remote,
      cachePaths,
      fileRecordsByEnv,
      moduleKey,
      baseKey,
      transformed.dependencyRequestsByEnv,
      request.moduleIdentity,
      variants,
    );
  }

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileRecordsByEnv[request.envs[0]]?.contentHash ?? fileHash,
    prefix: fileRecordsByEnv[request.envs[0]]?.prefix ?? "",
    variants,
    fileRecordsByEnv,
  };
}

function groupTransformResults(
  resultsByEnv: Record<string, TransformResult>,
): Array<{
  variantId: string;
  environmentIds: string[];
  result: TransformResult;
}> {
  const groups = new Map<
    string,
    { environmentIds: string[]; result: TransformResult }
  >();
  for (const [envId, result] of Object.entries(resultsByEnv)) {
    const fingerprint = contentHash(
      JSON.stringify(result.fileRecord ?? result),
    );
    const existing = groups.get(fingerprint);
    if (existing) {
      existing.environmentIds.push(envId);
    } else {
      groups.set(fingerprint, { environmentIds: [envId], result });
    }
  }
  return Array.from(groups, ([variantId, group]) => ({
    variantId,
    environmentIds: group.environmentIds.sort(),
    result: group.result,
  }));
}

function collectVariants(
  fileRecordsByEnv: Record<string, FileRecord>,
): ModuleVariantRecord[] {
  const variants = new Map<string, ModuleVariantRecord>();
  for (const [envId, record] of Object.entries(fileRecordsByEnv)) {
    const variantId =
      record.variantId ??
      contentHash(
        JSON.stringify(record, (key, value) =>
          key === "envs" || key === "environmentIds" ? undefined : value,
        ),
      );
    const existing = variants.get(variantId);
    if (existing) {
      if (!existing.environmentIds.includes(envId)) {
        existing.environmentIds.push(envId);
      }
      continue;
    }
    const environmentIds = record.environmentIds ?? record.envs ?? [envId];
    const targetIds =
      record.targetIds ??
      Array.from(
        new Set(
          environmentIds.map((scopeId) => scopeId.split("::", 1)[0] ?? scopeId),
        ),
      );
    variants.set(variantId, {
      variantId,
      environment: record.environment,
      targetIds,
      environmentIds: [...environmentIds],
      record: {
        ...record,
        variantId,
        targetIds,
        environmentIds,
        envs: environmentIds,
      },
    });
  }
  return Array.from(variants.values());
}

async function transformFile(
  request: WorkerRequest,
): Promise<TransformFileOutput> {
  const representationHandler =
    typeof request.resolutionMeta?.representationHandler === "string"
      ? request.resolutionMeta.representationHandler
      : undefined;
  const representationTransform = representationHandler
    ? request.workerProfile.representationTransforms[representationHandler]
    : undefined;
  if (representationTransform) {
    request = await applyRepresentationWorkerTransform(
      request,
      representationHandler!,
      representationTransform,
    );
  }
  if (request.moduleType === "asset") {
    return transformAssetFile(request);
  }
  if (request.moduleType === "css") {
    return transformCssFile(request);
  }
  const { prepareCoreTransform } = await import("./transform/core.js");
  const results: Record<string, TransformResult> = {};
  const preResults: Record<
    string,
    Awaited<ReturnType<typeof applyBabelStage>>
  > = {};
  const preparedByEnv: Record<
    string,
    ReturnType<typeof prepareCoreTransform>
  > = {};
  const requestsByEnv: Record<string, WorkerImportRequest[]> = {};
  const preparedCache = new Map<
    string,
    ReturnType<typeof prepareCoreTransform>
  >();
  const preparedKeysByEnv: Record<string, string> = {};
  const orderedTransformStages = [
    ...request.workerProfile.transformPre,
    ...request.workerProfile.transform,
    ...request.workerProfile.transformFinalize,
  ];
  const pipelineCache = new Map<
    string,
    Awaited<ReturnType<typeof applyBabelStage>>
  >();

  for (const envId of request.envs) {
    const initialCode = request.codeByEnv?.[envId] ?? request.code;
    const initialMap = request.mapByEnv?.[envId];
    const pipeline = selectTransformPipeline(
      orderedTransformStages,
      request.environments[envId],
      request.targetIds[envId],
      "environment",
    );
    const transformEnvId = pipeline.environmentScoped ? envId : undefined;
    const pipelineKey = contentHash(
      JSON.stringify({
        codeHash: contentHash(initialCode),
        mapHash: initialMap ? contentHash(initialMap) : null,
        specs: pipeline.specs,
        environmentId: pipeline.environmentScoped
          ? request.environments[envId]
          : undefined,
      }),
    );
    let environmentResult = pipelineCache.get(pipelineKey);
    if (!environmentResult) {
      environmentResult = await applyCachedBabelPipeline(
        initialCode,
        initialMap,
        request,
        transformEnvId,
        pipeline.specs,
      );
      pipelineCache.set(pipelineKey, environmentResult);
    }
    const definedResult = await applyTargetDefines(
      environmentResult,
      request,
      envId,
    );
    const targetPipeline = selectTransformPipeline(
      orderedTransformStages,
      request.environments[envId],
      request.targetIds[envId],
      "target",
    );
    const targetResult = await applyCachedBabelPipeline(
      definedResult.code,
      definedResult.map,
      request,
      targetPipeline.targetScoped ? envId : undefined,
      targetPipeline.specs,
    );
    preResults[envId] = {
      ...targetResult,
      metadata: {
        ...(definedResult.metadata ?? {}),
        ...(targetResult.metadata ?? {}),
      },
    };
  }

  for (const envId of request.envs) {
    const preResult = preResults[envId];
    const preparedKey = JSON.stringify({
      codeHash: contentHash(preResult.code),
      sourceFileName: request.sourceMap?.sourceFileName,
      syntax: request.syntax,
    });
    let prepared = preparedCache.get(preparedKey);
    if (!prepared) {
      prepared = prepareCoreTransform(
        {
          code: preResult.code,
          realPath: request.realPath,
          syntax: request.syntax,
        },
        request.sourceMap?.sourceFileName,
      );
      preparedCache.set(preparedKey, prepared);
    }
    preparedKeysByEnv[envId] = preparedKey;
    preparedByEnv[envId] = prepared;
    requestsByEnv[envId] = prepared.importRequests;
  }

  const hasImports = Object.values(requestsByEnv).some(
    (requests) => requests.length > 0,
  );
  const resolvedImportsByEnv = hasImports
    ? await requestCoordinator<ResolvedImportsByEnv>({
        type: "resolve-imports",
        requestsByEnv,
      })
    : {};

  const coreResultCache = new Map<string, TransformResult>();
  const coreResultsByEnv: Record<string, TransformResult> = {};
  const coreCellsByEnv: Record<string, CellRecord[]> = {};
  const sourceContentsByEnv: Record<string, Record<string, string>> = {};
  for (const envId of request.envs) {
    const preResult = preResults[envId];
    const coreCacheKey = JSON.stringify({
      preparedKey: preparedKeysByEnv[envId],
      resolvedImports: resolvedImportsByEnv[envId] ?? {},
      hmr: request.dev?.hmr === true && request.targets[envId] === "browser",
    });
    let coreResult = coreResultCache.get(coreCacheKey);
    if (!coreResult) {
      coreResult = await applyCachedCoreTransform(
        request,
        envId,
        preResult.code,
        resolvedImportsByEnv[envId],
        structuredClone(preparedByEnv[envId]),
      );
      coreResultCache.set(coreCacheKey, coreResult);
    }
    const parsedPreMap = preResult.map
      ? (JSON.parse(preResult.map) as Record<string, unknown>)
      : undefined;
    const sourceContents: Record<string, string> = {};
    if (request.sourceMap?.sourcesContent) {
      if (parsedPreMap) {
        collectSourceContents(parsedPreMap, request, sourceContents);
      } else {
        sourceContents[request.sourceMap.sourceFileName] = preResult.code;
      }
    }
    const coreCells = (coreResult.fileRecord?.cells ?? []).map((cell) => ({
      ...cell,
      map: composeSourceMaps(cell.map, preResult.map, parsedPreMap),
    }));
    coreResultsByEnv[envId] = coreResult;
    coreCellsByEnv[envId] = coreResult.fileRecord ? coreCells : [];
    sourceContentsByEnv[envId] = sourceContents;
  }
  await applyPostTransformPipelines(
    coreCellsByEnv,
    request,
    request.workerProfile.transformPost,
  );

  for (const envId of request.envs) {
    const preResult = preResults[envId];
    const coreResult = coreResultsByEnv[envId];
    const postCells = coreCellsByEnv[envId];
    const sourceContents = sourceContentsByEnv[envId];
    const metadata = preResult.metadata as
      | {
          conditionalBundlerExtraOutputs?: Record<string, ExtraTransformOutput>;
          conditionalBundlerDiscoveredEntrypoints?: DiscoveredEntrypoint[];
          conditionalBundlerLinkReferences?: LinkReference[];
        }
      | undefined;
    const linkReferences = dedupeLinkReferences([
      ...(request.linkReferencesByEnv?.[envId] ?? []),
      ...(metadata?.conditionalBundlerLinkReferences ?? []),
    ]);
    const normalizedCells = postCells.map((cell) => ({
      ...cell,
      map: normalizeSourceMap(cell.map, request, sourceContents),
      linkReferences: linkReferences.filter(
        (reference) =>
          cell.code != null &&
          "symbol" in reference &&
          typeof reference.symbol === "string" &&
          cell.code.includes(reference.symbol),
      ),
    }));
    const extraOutputs = hydrateResourceReferences(
      {
        ...(request.extraOutputsByEnv?.[envId] ?? {}),
        ...(coreResult.extraOutputs ?? {}),
        ...(metadata?.conditionalBundlerExtraOutputs ?? {}),
      },
      resolvedImportsByEnv[envId] ?? {},
    );
    const discoveredEntrypoints = [
      ...(coreResult.fileRecord?.discoveredEntrypoints ?? []),
      ...(request.discoveredEntrypointsByEnv?.[envId] ?? []),
      ...(metadata?.conditionalBundlerDiscoveredEntrypoints ?? []),
    ];
    results[envId] = {
      ...coreResult,
      fileRecord: coreResult.fileRecord
        ? {
            ...coreResult.fileRecord,
            discoveredEntrypoints,
            linkReferences,
            extraOutputs:
              Object.keys(extraOutputs).length > 0 ? extraOutputs : undefined,
            sourceContents:
              Object.keys(sourceContents).length > 0
                ? sourceContents
                : undefined,
            cells: normalizedCells,
          }
        : undefined,
    };
  }

  return {
    resultsByEnv: results,
    dependencyRequestsByEnv: requestsByEnv,
    resolvedImportsByEnv,
  };
}

type WorkerRepresentationTransformContext = {
  id: string;
  moduleIdentity: string;
  canonicalPath: string;
  representation: string;
  environmentId: string;
  environmentIds: string[];
  targetId: string;
  targetIds: string[];
  platform: "node" | "browser";
  source: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
  pkg: { name: string; version: string };
  buildMode: string;
  dev: { hmr: boolean };
};

type WorkerRepresentationTransformResult = {
  code: string;
  map?: string;
  extraOutputs?: Record<string, ExtraTransformOutput>;
  discoveredEntrypoints?: DiscoveredEntrypoint[];
  linkReferences?: LinkReference[];
};

async function applyRepresentationWorkerTransform(
  request: WorkerRequest,
  handlerIdentity: string,
  spec: WorkerBabelPluginSpec,
): Promise<WorkerRequest> {
  const representationBase = request.resolutionMeta?.representationBase;
  const representation =
    typeof representationBase === "string"
      ? representationBase
      : request.importRepresentation;
  if (!representation) {
    throw new Error(
      `Representation handler '${handlerIdentity}' was selected without an as value.`,
    );
  }
  const transform = await loadRepresentationTransform(spec.modulePath);
  const bytes = request.sourceBytes ?? new TextEncoder().encode(request.code);
  const results = await Promise.all(
    request.envs.map(async (envId) => {
      const result = await transform(
        {
          id: request.id,
          moduleIdentity: request.moduleIdentity,
          canonicalPath: request.canonicalPath ?? request.moduleIdentity,
          representation,
          environmentId: request.environments[envId],
          environmentIds: Array.from(
            new Set(
              (request.allEnvIds ?? request.envs).map(
                (scopeId) => request.environments[scopeId],
              ),
            ),
          ),
          targetId: request.targetIds[envId],
          targetIds: Array.from(
            new Set(
              (request.allEnvIds ?? request.envs).map(
                (scopeId) => request.targetIds[scopeId],
              ),
            ),
          ),
          platform: request.targets[envId],
          source: request.sourceBytes ? "" : request.code,
          bytes: bytes.slice(),
          metadata: request.resolutionMeta
            ? structuredClone(request.resolutionMeta)
            : undefined,
          pkg: {
            name: request.pkg.name,
            version: request.pkg.version,
          },
          buildMode: request.buildMode ?? "development",
          dev: {
            hmr:
              request.dev?.hmr === true && request.targets[envId] === "browser",
          },
        },
        { ...(spec.options ?? {}) },
      );
      if (!result || typeof result !== "object") {
        throw new Error(
          `Representation worker transform '${handlerIdentity}' returned ${String(result)}.`,
        );
      }
      if (typeof result.code !== "string") {
        throw new Error(
          `Representation worker transform '${handlerIdentity}' must return JavaScript code.`,
        );
      }
      if (result.map !== undefined && typeof result.map !== "string") {
        throw new Error(
          `Representation worker transform '${handlerIdentity}' returned a non-string source map.`,
        );
      }
      try {
        return structuredClone(result);
      } catch (error) {
        throw new Error(
          `Representation worker transform '${handlerIdentity}' returned non-serializable data.`,
          { cause: error },
        );
      }
    }),
  );
  const byEnv = Object.fromEntries(
    request.envs.map((envId, index) => [envId, results[index]]),
  );
  return {
    ...request,
    code: results[0]?.code ?? "",
    moduleType: "javascript",
    syntax: { jsx: false, ts: false },
    codeByEnv: Object.fromEntries(
      request.envs.map((envId) => [envId, byEnv[envId].code]),
    ),
    mapByEnv: Object.fromEntries(
      request.envs.flatMap((envId) =>
        byEnv[envId].map ? [[envId, byEnv[envId].map!]] : [],
      ),
    ),
    extraOutputsByEnv: Object.fromEntries(
      request.envs.map((envId) => [
        envId,
        {
          ...(request.extraOutputsByEnv?.[envId] ?? {}),
          ...(byEnv[envId].extraOutputs ?? {}),
        },
      ]),
    ),
    discoveredEntrypointsByEnv: Object.fromEntries(
      request.envs.map((envId) => [
        envId,
        [
          ...(request.discoveredEntrypointsByEnv?.[envId] ?? []),
          ...(byEnv[envId].discoveredEntrypoints ?? []),
        ],
      ]),
    ),
    linkReferencesByEnv: Object.fromEntries(
      request.envs.map((envId) => [
        envId,
        [
          ...(request.linkReferencesByEnv?.[envId] ?? []),
          ...(byEnv[envId].linkReferences ?? []),
        ],
      ]),
    ),
  };
}

async function applyPostTransformPipelines(
  cellsByEnv: Record<string, CellRecord[]>,
  request: WorkerRequest,
  entries: WorkerScopedBabelPluginSpec[],
): Promise<void> {
  const environmentCache = new Map<string, CellRecord[]>();
  for (const scopeId of request.envs) {
    const environmentPipeline = selectTransformPipeline(
      entries,
      request.environments[scopeId],
      request.targetIds[scopeId],
      "environment",
    );
    const environmentScopeId = environmentPipeline.environmentScoped
      ? scopeId
      : undefined;
    const environmentKey = contentHash(
      JSON.stringify({
        cells: cellsByEnv[scopeId],
        specs: environmentPipeline.specs,
        environmentId: request.environments[scopeId],
      }),
    );
    let transformed = environmentCache.get(environmentKey);
    if (!transformed) {
      transformed = await applyCachedBabelPipelineToCells(
        cellsByEnv[scopeId],
        request,
        environmentScopeId,
        environmentPipeline.specs,
      );
      environmentCache.set(environmentKey, transformed);
    }
    const targetPipeline = selectTransformPipeline(
      entries,
      request.environments[scopeId],
      request.targetIds[scopeId],
      "target",
    );
    cellsByEnv[scopeId] = await applyCachedBabelPipelineToCells(
      transformed,
      request,
      targetPipeline.targetScoped ? scopeId : undefined,
      targetPipeline.specs,
    );
  }
}

function transformEntryApplies(
  entry: WorkerScopedBabelPluginSpec,
  environmentId: string,
  targetId: string,
): boolean {
  const environmentApplies =
    entry.environments === undefined ||
    entry.environments === "each" ||
    entry.environments.includes(environmentId);
  const targetApplies =
    entry.targets === undefined ||
    entry.targets === "each" ||
    entry.targets.includes(targetId);
  return environmentApplies && targetApplies;
}

function sharedTransformIdentity(identity: string): string {
  return identity.replace(/::environment=[^:]+$/, "");
}

function selectTransformPipeline(
  entries: WorkerScopedBabelPluginSpec[],
  environmentId: string,
  targetId: string,
  phase: "environment" | "target",
): {
  specs: WorkerPipelineBabelPluginSpec[];
  environmentScoped: boolean;
  targetScoped: boolean;
} {
  const applicable = entries.filter(
    (entry) =>
      (phase === "target"
        ? entry.targets !== undefined
        : entry.targets === undefined) &&
      transformEntryApplies(entry, environmentId, targetId),
  );
  return {
    specs: applicable.map((entry) => ({
      plugin: entry.plugin,
      environmentScoped: entry.environments !== undefined,
      targetScoped: entry.targets !== undefined,
    })),
    environmentScoped: applicable.some(
      (entry) => entry.environments !== undefined,
    ),
    targetScoped: applicable.some((entry) => entry.targets !== undefined),
  };
}

async function applyTargetDefines(
  input: { code: string; map?: string; metadata?: Record<string, unknown> },
  request: WorkerRequest,
  scopeId: string,
): Promise<{ code: string; map?: string; metadata?: Record<string, unknown> }> {
  const defines = request.defines[scopeId] ?? {};
  if (Object.keys(defines).length === 0) return input;
  const result = await transformAsync(input.code, {
    filename: request.realPath,
    sourceMaps: Boolean(request.sourceMap),
    inputSourceMap:
      request.sourceMap && input.map ? JSON.parse(input.map) : undefined,
    parserOpts: {
      plugins: [
        ...(request.syntax.jsx ? ["jsx"] : []),
        ...(request.syntax.ts
          ? [
              ["typescript", { isTSX: request.syntax.jsx }] as [
                "typescript",
                { isTSX: boolean },
              ],
            ]
          : []),
      ],
    },
    plugins: [
      function targetDefinesBabelPlugin(api: {
        types: typeof import("@babel/types");
      }) {
        const t = api.types;
        return {
          name: "bundler-target-defines",
          visitor: {
            Identifier(identifierPath: {
              node: { name: string };
              isReferencedIdentifier(): boolean;
              scope: { hasBinding(name: string): boolean };
              parentPath?: {
                isObjectProperty(value?: Record<string, unknown>): boolean;
                node: { shorthand?: boolean };
              };
              replaceWith(node: import("@babel/types").Expression): void;
            }) {
              const name = identifierPath.node.name;
              if (
                !Object.prototype.hasOwnProperty.call(defines, name) ||
                !identifierPath.isReferencedIdentifier() ||
                identifierPath.scope.hasBinding(name)
              ) {
                return;
              }
              if (
                identifierPath.parentPath?.isObjectProperty({
                  shorthand: true,
                })
              ) {
                identifierPath.parentPath.node.shorthand = false;
              }
              identifierPath.replaceWith(t.valueToNode(defines[name]));
            },
          },
        };
      },
    ],
  });
  if (!result?.code) {
    throw new Error(
      `Target define transform produced no code for '${request.id}'.`,
    );
  }
  return {
    code: result.code,
    map: result.map ? JSON.stringify(result.map) : input.map,
    metadata: input.metadata,
  };
}

async function applyCachedBabelPipeline(
  code: string,
  map: string | undefined,
  request: WorkerRequest,
  envId: string | undefined,
  specs: WorkerPipelineBabelPluginSpec[],
): Promise<{ code: string; map?: string; metadata?: Record<string, unknown> }> {
  if (specs.length === 0) {
    return { code, map };
  }
  const environmentScoped = specs.some(
    (entry) => entry.environmentScoped || entry.targetScoped,
  );
  const targetScoped = specs.some((entry) => entry.targetScoped);
  const key = contentHash(
    JSON.stringify({
      format: 6,
      moduleIdentity: environmentScoped
        ? request.moduleIdentity
        : sharedTransformIdentity(request.moduleIdentity),
      codeHash: contentHash(code),
      mapHash: map ? contentHash(map) : null,
      specs,
      pluginHashes: await Promise.all(
        specs.map(async (entry) => {
          try {
            return contentHash(await fs.readFile(entry.plugin.modulePath));
          } catch {
            return null;
          }
        }),
      ),
      environmentId:
        environmentScoped && envId ? request.environments[envId] : undefined,
      targetId: targetScoped && envId ? request.targetIds[envId] : undefined,
      platform: targetScoped && envId ? request.targets[envId] : undefined,
      syntax: request.syntax,
      buildMode: request.buildMode,
      resolutionMeta: request.resolutionMeta,
      sourceMap: request.sourceMap
        ? {
            sourceFileName: request.sourceMap.sourceFileName,
            sourcesContent: request.sourceMap.sourcesContent,
          }
        : null,
    }),
  );
  const cachePath = path.join(
    request.sharedCacheDir,
    "transform-pipelines",
    `${key}.json`,
  );
  const cached = await readJsonIfExists<{
    code: string;
    map?: string;
    metadata?: Record<string, unknown>;
  }>(cachePath);
  if (cached) {
    return cached;
  }
  const result = await applyBabelStage(code, map, request, envId, specs);
  await writeJsonAtomic(cachePath, result);
  return result;
}

async function applyCachedBabelPipelineToCells(
  cells: CellRecord[],
  request: WorkerRequest,
  envId: string | undefined,
  specs: WorkerPipelineBabelPluginSpec[],
): Promise<CellRecord[]> {
  if (specs.length === 0) {
    return cells;
  }
  const transformed: CellRecord[] = [];
  for (const cell of cells) {
    if (cell.kind === "generated" || cell.code == null) {
      transformed.push(cell);
      continue;
    }
    const result = await applyCachedBabelPipeline(
      cell.code,
      cell.map,
      request,
      envId,
      specs,
    );
    transformed.push({ ...cell, code: result.code, map: result.map });
  }
  return transformed;
}

async function applyCachedCoreTransform(
  request: WorkerRequest,
  envId: string,
  code: string,
  resolvedImports: ResolvedImportsByEnv[string] | undefined,
  prepared: unknown,
): Promise<TransformResult> {
  const dev = {
    hmr: request.dev?.hmr === true && request.targets[envId] === "browser",
  };
  const key = contentHash(
    JSON.stringify({
      format: 6,
      moduleIdentity: request.moduleIdentity,
      canonicalPath: request.canonicalPath ?? request.moduleIdentity,
      pkg: {
        name: request.pkg.name,
        version: request.pkg.version,
      },
      syntax: request.syntax,
      codeHash: contentHash(code),
      resolvedImports: resolvedImports ?? {},
      dev,
      sourceMap: request.sourceMap
        ? {
            sourceFileName: request.sourceMap.sourceFileName,
            sourcesContent: request.sourceMap.sourcesContent,
          }
        : null,
    }),
  );
  const cachePath = path.join(
    request.sharedCacheDir,
    "core-variants",
    `${key}.json`,
  );
  const cached = await readJsonIfExists<TransformResult>(cachePath);
  if (cached) {
    return cached;
  }
  const { transformWithCore } = await import("./transform/core.js");
  const result = transformWithCore(
    {
      id: request.id,
      moduleIdentity: request.moduleIdentity,
      canonicalPath: request.canonicalPath ?? request.moduleIdentity,
      code,
      realPath: request.realPath,
      pkg: request.pkg,
      syntax: request.syntax,
      envs: request.allEnvIds ?? request.envs,
      envId,
      resolvedImports,
      dev,
    },
    {
      importAttrAllow: ["json"],
      generateModuleOutput: false,
      sourceMap: request.sourceMap
        ? {
            sourceFileName: request.sourceMap.sourceFileName,
            sourcesContent: request.sourceMap.sourcesContent,
            embedCellSourcesContent: false,
          }
        : undefined,
    },
    prepared as Parameters<typeof transformWithCore>[2],
  );
  await writeJsonAtomic(cachePath, result);
  return result;
}

async function transformAssetFile(
  request: WorkerRequest,
): Promise<TransformFileOutput> {
  const { prepareAssetTransform, transformAsset } =
    await import("./transform/asset.js");
  const bytes = request.sourceBytes;
  if (!bytes) {
    throw new Error(
      `Asset '${request.canonicalPath ?? request.realPath}' has no source bytes.`,
    );
  }
  const assetId = request.resolutionMeta?.assetId;
  if (typeof assetId !== "string") {
    throw new Error(
      `Asset '${request.canonicalPath ?? request.realPath}' has no portable asset identity.`,
    );
  }
  const representationBase = request.resolutionMeta?.representationBase;
  const representation =
    typeof representationBase === "string"
      ? representationBase
      : request.importRepresentation;
  if (
    representation !== "url" &&
    representation !== "url_and_deps_array" &&
    representation !== "raw" &&
    representation !== "base64" &&
    representation !== "image-reference-with-size"
  ) {
    throw new Error(
      `Unsupported built-in representation '${String(representation)}'.`,
    );
  }
  const normalModuleIdentity = request.resolutionMeta?.normalModuleIdentity;
  const normalType = request.resolutionMeta?.normalType;
  const primaryOutputType = request.resolutionMeta?.primaryOutputType;
  const createInput = (
    envId: string,
  ): import("./transform/asset.js").AssetTransformInput => ({
    id: request.id,
    moduleIdentity: request.moduleIdentity,
    canonicalPath: request.canonicalPath ?? request.moduleIdentity,
    realPath: request.realPath,
    bytes,
    representation,
    assetId,
    normalModuleIdentity:
      typeof normalModuleIdentity === "string" ? normalModuleIdentity : assetId,
    normalType:
      normalType === "javascript" ||
      normalType === "css" ||
      normalType === "asset"
        ? normalType
        : ("asset" as const),
    primaryOutputType:
      typeof primaryOutputType === "string" ? primaryOutputType : "asset",
    requestedEnvironment:
      typeof request.resolutionMeta?.requestedEnvironment === "string"
        ? request.resolutionMeta.requestedEnvironment
        : undefined,
    requestedTarget:
      typeof request.resolutionMeta?.requestedTarget === "string"
        ? request.resolutionMeta.requestedTarget
        : undefined,
    requestedUrlMode:
      request.resolutionMeta?.requestedUrlMode === "public" ||
      request.resolutionMeta?.requestedUrlMode === "module-relative"
        ? request.resolutionMeta.requestedUrlMode
        : undefined,
    pkg: request.pkg,
    envs: request.allEnvIds ?? request.envs,
    envId,
    dev: {
      hmr: request.dev?.hmr === true && request.targets[envId] === "browser",
    },
  });
  const preparation = prepareAssetTransform(createInput(request.envs[0]));
  const requests = preparation.prepared.importRequests;
  const requestsByEnv = Object.fromEntries(
    request.envs.map((envId) => [envId, requests]),
  );
  const resolvedImportsByEnv =
    requests.length > 0
      ? await requestCoordinator<ResolvedImportsByEnv>({
          type: "resolve-imports",
          requestsByEnv,
        })
      : {};
  const resultCache = new Map<string, TransformResult>();
  const resultsByEnv = Object.fromEntries(
    request.envs.map((envId) => {
      const input = createInput(envId);
      const resolved = resolvedImportsByEnv[envId] ?? {};
      const cacheKey = JSON.stringify({
        hmr: input.dev?.hmr,
        resolved,
      });
      let result = resultCache.get(cacheKey);
      if (!result) {
        result = transformAsset(input, resolved, preparation);
        resultCache.set(cacheKey, result);
      }
      return [envId, result];
    }),
  );
  return {
    resultsByEnv,
    dependencyRequestsByEnv: requestsByEnv,
    resolvedImportsByEnv,
  };
}

async function transformCssFile(
  request: WorkerRequest,
): Promise<TransformFileOutput> {
  const { analyzeCss, finalizeCssTransform } =
    await import("./transform/css.js");
  const analyses: Record<string, ReturnType<typeof analyzeCss>> = {};
  const requestsByEnv: Record<string, WorkerImportRequest[]> = {};
  const analysisCache = new Map<string, ReturnType<typeof analyzeCss>>();
  for (const envId of request.envs) {
    const input = {
      id: request.id,
      moduleIdentity: request.moduleIdentity,
      canonicalPath: request.canonicalPath ?? request.moduleIdentity,
      realPath: request.realPath,
      code: request.codeByEnv?.[envId] ?? request.code,
      pkg: request.pkg,
      envs: request.envs,
      envId,
      target: request.targets[envId] ?? "browser",
      buildMode: request.buildMode ?? "development",
      sourceMap: request.sourceMap
        ? {
            sourceFileName: request.sourceMap.sourceFileName,
            sourcesContent: request.sourceMap.sourcesContent,
          }
        : undefined,
      dev: {
        hmr: request.dev?.hmr === true && request.targets[envId] === "browser",
      },
    };
    const analysisKey = JSON.stringify({
      codeHash: contentHash(input.code),
      buildMode: input.buildMode,
      sourceMap: input.sourceMap,
    });
    let analysis = analysisCache.get(analysisKey);
    if (!analysis) {
      analysis = analyzeCss(input);
      analysisCache.set(analysisKey, analysis);
    }
    analyses[envId] = analysis;
    requestsByEnv[envId] = analysis.requests;
  }
  const hasRequests = Object.values(requestsByEnv).some(
    (requests) => requests.length > 0,
  );
  const resolvedByEnv = hasRequests
    ? await requestCoordinator<ResolvedImportsByEnv>({
        type: "resolve-imports",
        requestsByEnv,
      })
    : {};
  const resultsByEnv = Object.fromEntries(
    request.envs.map((envId) => [
      envId,
      finalizeCssTransform(
        {
          id: request.id,
          moduleIdentity: request.moduleIdentity,
          canonicalPath: request.canonicalPath ?? request.moduleIdentity,
          realPath: request.realPath,
          code: request.codeByEnv?.[envId] ?? request.code,
          pkg: request.pkg,
          envs: request.allEnvIds ?? request.envs,
          envId,
          target: request.targets[envId] ?? "browser",
          buildMode: request.buildMode ?? "development",
          sourceMap: request.sourceMap
            ? {
                sourceFileName: request.sourceMap.sourceFileName,
                sourcesContent: request.sourceMap.sourcesContent,
              }
            : undefined,
          dev: {
            hmr:
              request.dev?.hmr === true && request.targets[envId] === "browser",
          },
        },
        analyses[envId],
        resolvedByEnv[envId] ?? {},
      ),
    ]),
  );
  return {
    resultsByEnv,
    dependencyRequestsByEnv: requestsByEnv,
    resolvedImportsByEnv: resolvedByEnv,
  };
}

function hydrateResourceReferences(
  outputs: Record<string, ExtraTransformOutput>,
  resolvedImports: ResolvedImportsByEnv[string],
): Record<string, ExtraTransformOutput> {
  const assetIdsByRequest = new Map<string, string>();
  const cssIdsByRequest = new Map<string, string>();
  for (const resolved of Object.values(resolvedImports)) {
    const request = resolved.meta?.request;
    const assetId = resolved.meta?.assetId;
    if (typeof request === "string" && typeof assetId === "string") {
      assetIdsByRequest.set(request, assetId);
    }
    const cssId = resolved.meta?.cssId;
    if (typeof request === "string" && typeof cssId === "string") {
      cssIdsByRequest.set(request, cssId);
    }
  }
  return Object.fromEntries(
    Object.entries(outputs).map(([name, output]) => {
      const references =
        output.template?.references.map((reference) => {
          if (
            reference.kind !== "asset-url" ||
            reference.assetId ||
            !reference.request
          ) {
            return reference;
          }
          const assetId = assetIdsByRequest.get(reference.request);
          if (!assetId) {
            throw new Error(
              `Could not resolve resource URL '${reference.request}' from '${reference.ownerId ?? "resource"}'.`,
            );
          }
          return { ...reference, assetId };
        }) ?? [];
      const metadata =
        output.metadata && typeof output.metadata === "object"
          ? (output.metadata as Record<string, unknown>)
          : undefined;
      const imports = Array.isArray(metadata?.imports)
        ? metadata.imports.map((item) => {
            if (!item || typeof item !== "object") return item;
            const dependency = item as Record<string, unknown>;
            const request = dependency.request;
            return typeof request === "string"
              ? {
                  ...dependency,
                  moduleId: cssIdsByRequest.get(request),
                }
              : item;
          })
        : undefined;
      return [
        name,
        {
          ...output,
          template: output.template
            ? { ...output.template, references }
            : undefined,
          metadata: metadata
            ? { ...metadata, ...(imports ? { imports } : {}) }
            : output.metadata,
        },
      ];
    }),
  );
}

function dedupeLinkReferences(references: LinkReference[]): LinkReference[] {
  return Array.from(
    new Map(references.map((reference) => [reference.id, reference])).values(),
  );
}

async function applyBabelStage(
  code: string,
  map: string | undefined,
  request: WorkerRequest,
  envId: string | undefined,
  specs: WorkerPipelineBabelPluginSpec[],
): Promise<{ code: string; map?: string; metadata?: Record<string, unknown> }> {
  const applicableSpecs = specs.filter(
    (entry) =>
      entry.plugin.options?.__bundlerExcludeNodeModules !== true ||
      !isNodeModulesPath(request.realPath),
  );
  if (applicableSpecs.length === 0) {
    return { code, map };
  }
  const plugins = await Promise.all(
    applicableSpecs.map(async (entry, index) => {
      const spec = entry.plugin;
      const pluginEnvId =
        entry.environmentScoped || entry.targetScoped ? envId : undefined;
      const loaded = await loadBabelPlugin(spec.modulePath);
      const pluginOptions = { ...(spec.options ?? {}) };
      delete pluginOptions.__bundlerExcludeNodeModules;
      const environmentId = pluginEnvId
        ? request.environments[pluginEnvId]
        : undefined;
      return [
        loaded,
        {
          ...pluginOptions,
          environments: Array.from(
            new Set(
              request.envs.map((scopeId) => request.environments[scopeId]),
            ),
          ),
          targets: Array.from(
            new Set(request.envs.map((scopeId) => request.targetIds[scopeId])),
          ),
          ...(pluginEnvId
            ? {
                environmentId,
                ...(entry.targetScoped
                  ? {
                      targetId: request.targetIds[pluginEnvId],
                      platform: request.targets[pluginEnvId],
                    }
                  : {}),
              }
            : {}),
          filePath: request.realPath,
          id:
            entry.environmentScoped || entry.targetScoped
              ? request.id
              : sharedTransformIdentity(request.id),
          moduleIdentity:
            entry.environmentScoped || entry.targetScoped
              ? request.moduleIdentity
              : sharedTransformIdentity(request.moduleIdentity),
          buildMode: request.buildMode ?? "development",
          pkg: request.pkg,
          syntax: request.syntax,
          representation: request.importRepresentation,
          format: request.resolutionMeta?.format,
          reactCjsEnv: request.resolutionMeta?.reactCjsEnv,
        },
        `${environmentId ?? "shared"}:${
          entry.targetScoped
            ? (request.targetIds[pluginEnvId ?? ""] ?? "shared")
            : "all-targets"
        }:${index}:${spec.modulePath}`,
      ] as const;
    }),
  );
  const result = await transformAsync(code, {
    filename: request.realPath,
    sourceMaps: Boolean(request.sourceMap),
    inputSourceMap: request.sourceMap && map ? JSON.parse(map) : undefined,
    parserOpts: {
      plugins: [
        ...(request.syntax.jsx ? ["jsx"] : []),
        ...(request.syntax.ts
          ? [
              ["typescript", { isTSX: request.syntax.jsx }] as [
                "typescript",
                { isTSX: boolean },
              ],
            ]
          : []),
      ],
    },
    plugins,
  });
  return {
    code: result?.code ?? code,
    map: request.sourceMap
      ? result?.map
        ? JSON.stringify(result.map)
        : map
      : undefined,
    metadata: result?.metadata,
  };
}

function isNodeModulesPath(filePath: string): boolean {
  return normalizePosixPath(filePath).split("/").includes("node_modules");
}

function composeSourceMaps(
  generatedMap: string | undefined,
  inputMap: string | undefined,
  parsedInputMap?: Record<string, unknown>,
): string | undefined {
  if (!generatedMap) {
    return undefined;
  }
  if (!inputMap) {
    return generatedMap;
  }
  const maps = [
    JSON.parse(generatedMap),
    parsedInputMap ?? JSON.parse(inputMap),
  ] as unknown as Parameters<typeof remapping>[0];
  return JSON.stringify(
    remapping(maps, () => null, {
      excludeContent: true,
      decodedMappings: false,
    }),
  );
}

function collectSourceContents(
  map: Record<string, unknown>,
  request: WorkerRequest,
  output: Record<string, string>,
): void {
  if (Array.isArray(map.sections)) {
    for (const section of map.sections) {
      if (
        section &&
        typeof section === "object" &&
        "map" in section &&
        section.map &&
        typeof section.map === "object"
      ) {
        collectSourceContents(
          section.map as Record<string, unknown>,
          request,
          output,
        );
      }
    }
    return;
  }
  if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) {
    return;
  }
  const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
  for (const [index, source] of map.sources.entries()) {
    const content = map.sourcesContent[index];
    if (typeof source !== "string" || typeof content !== "string") {
      continue;
    }
    output[normalizeSourceName(source, sourceRoot, request)] = content;
  }
}

function normalizeSourceMap(
  map: string | undefined,
  request: WorkerRequest,
  sourceContents?: Record<string, string>,
): string | undefined {
  if (!map || !request.sourceMap) {
    return undefined;
  }
  const parsed = JSON.parse(map) as Record<string, unknown>;
  normalizeSourceMapObject(parsed, request, sourceContents);
  return JSON.stringify(parsed);
}

function normalizeSourceMapObject(
  map: Record<string, unknown>,
  request: WorkerRequest,
  sourceContents?: Record<string, string>,
): void {
  if (Array.isArray(map.sections)) {
    for (const section of map.sections) {
      if (
        section &&
        typeof section === "object" &&
        "map" in section &&
        section.map &&
        typeof section.map === "object"
      ) {
        normalizeSourceMapObject(
          section.map as Record<string, unknown>,
          request,
          sourceContents,
        );
      }
    }
    return;
  }

  const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
  if (Array.isArray(map.sources)) {
    map.sources = map.sources.map((source) =>
      typeof source === "string"
        ? normalizeSourceName(source, sourceRoot, request)
        : source,
    );
  }
  delete map.sourceRoot;
  if (
    sourceContents &&
    Array.isArray(map.sources) &&
    Array.isArray(map.sourcesContent)
  ) {
    for (const [index, source] of (map.sources as unknown[]).entries()) {
      const content = map.sourcesContent[index];
      if (typeof source === "string" && typeof content === "string") {
        sourceContents[source] = content;
      }
    }
    delete map.sourcesContent;
  } else if (!request.sourceMap?.sourcesContent) {
    delete map.sourcesContent;
  }
}

function normalizeSourceName(
  source: string,
  sourceRoot: string,
  request: WorkerRequest,
): string {
  if (source === request.sourceMap?.sourceFileName || isUrlLike(source)) {
    return source;
  }
  if (sourceRoot && isUrlLike(sourceRoot)) {
    try {
      return new URL(source, sourceRoot).href;
    } catch {
      return source;
    }
  }
  const rootedSource = sourceRoot ? path.join(sourceRoot, source) : source;
  const absoluteSource = path.isAbsolute(rootedSource)
    ? rootedSource
    : path.resolve(path.dirname(request.realPath), rootedSource);
  if (path.resolve(absoluteSource) === path.resolve(request.realPath)) {
    return request.sourceMap?.sourceFileName ?? source;
  }
  const relative = normalizePosixPath(
    path.relative(request.sourceMap!.outputDir, absoluteSource),
  );
  return relative || path.basename(absoluteSource);
}

function isUrlLike(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

async function loadBabelPlugin(modulePath: string): Promise<unknown> {
  if (babelModuleCache.has(modulePath)) {
    return babelModuleCache.get(modulePath);
  }
  const imported = await import(pathToFileURL(modulePath).href);
  const plugin = imported.default ?? imported;
  babelModuleCache.set(modulePath, plugin);
  return plugin;
}

async function loadRepresentationTransform(
  modulePath: string,
): Promise<
  (
    context: WorkerRepresentationTransformContext,
    options: Record<string, unknown>,
  ) =>
    | Promise<WorkerRepresentationTransformResult>
    | WorkerRepresentationTransformResult
> {
  const cached = representationTransformCache.get(modulePath);
  if (cached) return cached;
  const imported = await import(pathToFileURL(modulePath).href);
  const transform =
    imported.transformRepresentation ?? imported.default ?? imported;
  if (typeof transform !== "function") {
    throw new Error(
      `Representation worker module '${modulePath}' must export a transform function.`,
    );
  }
  representationTransformCache.set(modulePath, transform);
  return transform;
}

function buildBaseModuleKey(request: WorkerRequest): string {
  const envHashes = Object.fromEntries(
    Object.entries(request.codeByEnv ?? {}).map(([envId, code]) => [
      envId,
      contentHash(code),
    ]),
  );
  const mapHashes = Object.fromEntries(
    Object.entries(request.mapByEnv ?? {}).map(([envId, map]) => [
      envId,
      contentHash(map),
    ]),
  );
  const extraOutputHashes = Object.fromEntries(
    Object.entries(request.extraOutputsByEnv ?? {}).map(([envId, outputs]) => [
      envId,
      Object.fromEntries(
        Object.entries(outputs).map(([name, output]) => [
          name,
          contentHash(
            JSON.stringify({
              contentsHash:
                output.contents != null
                  ? contentHash(output.contents)
                  : undefined,
              template: output.template,
              map: output.map,
              metadata: output.metadata,
            }),
          ),
        ]),
      ),
    ]),
  );

  return JSON.stringify({
    artifactFormat: CELL_ARTIFACT_FORMAT,
    moduleIdentity: request.moduleIdentity,
    pkg: {
      name: request.pkg.name,
      version: request.pkg.version,
    },
    environment: Array.from(
      new Set(request.envs.map((scopeId) => request.environments[scopeId])),
    ).sort(),
    targetVariants: request.envs
      .map((scopeId) => ({
        targetId: request.targetIds[scopeId],
        platform: request.targets[scopeId],
        defines: request.defines[scopeId],
      }))
      .sort((left, right) => left.targetId.localeCompare(right.targetId)),
    syntax: request.syntax,
    codeHash: contentHash(request.sourceBytes ?? request.code),
    moduleType: request.moduleType ?? "javascript",
    importRepresentation: request.importRepresentation,
    canonicalPath: request.canonicalPath ?? request.moduleIdentity,
    buildMode: request.buildMode ?? "development",
    dev: {
      hmr: request.dev?.hmr === true,
    },
    transformConfig: request.transformConfig,
    resolutionMeta: request.resolutionMeta,
    envHashes,
    mapHashes,
    sourceMap: request.sourceMap
      ? {
          sourceFileName: request.sourceMap.sourceFileName,
          sourcesContent: request.sourceMap.sourcesContent,
        }
      : undefined,
    extraOutputHashes,
    linkReferencesByEnv: request.linkReferencesByEnv,
    workerProfile: request.workerProfile.fingerprint,
  });
}

function buildModuleKey(
  baseKey: string,
  resolvedImportsByEnv: ResolvedImportsByEnv,
): string {
  const resolved = Object.fromEntries(
    Object.entries(resolvedImportsByEnv)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([envId, entries]) => [
        envId,
        Object.fromEntries(
          Object.entries(entries)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => [
              key,
              {
                target: value.target,
                type: value.type,
                representation: value.representation,
                meta: value.meta,
              },
            ]),
        ),
      ]),
  );
  return JSON.stringify({ baseKey, resolved });
}

async function validateCacheCandidate(
  candidate: ModuleCacheRecord,
  request: WorkerRequest,
  baseKey: string,
): Promise<ModuleCacheRecord | null> {
  if (candidate.baseKey !== baseKey) return null;
  const resolvedImportsByEnv = await resolveDependencyRequests(
    candidate.dependencyRequestsByEnv,
  );
  return candidate.moduleKey === buildModuleKey(baseKey, resolvedImportsByEnv)
    ? candidate
    : null;
}

async function resolveDependencyRequests(
  requestsByEnv: Record<string, WorkerImportRequest[]>,
): Promise<ResolvedImportsByEnv> {
  return Object.values(requestsByEnv).some((requests) => requests.length > 0)
    ? await requestCoordinator<ResolvedImportsByEnv>({
        type: "resolve-imports",
        requestsByEnv,
      })
    : {};
}

function buildFileCachePaths(
  cacheRoot: string,
  canonicalPath: string,
  baseKey: string,
): FileCachePaths {
  const fileHash = contentHash(canonicalPath);
  const variantHash = contentHash(baseKey);
  const fileDir = path.join(cacheRoot, "files", fileHash, variantHash);
  return {
    fileHash,
    fileDir,
    artifactDir: path.join(cacheRoot, "variants", fileHash),
    modulePath: path.join(fileDir, "module.json"),
    remoteBaseKey: joinRemoteKey("files", fileHash, variantHash),
    remoteArtifactBaseKey: joinRemoteKey("variants", fileHash),
  };
}

function finalizeFileRecord(
  fileRecord: FileRecord,
  fileDir: string,
  envId: string,
): FileRecord {
  return {
    ...fileRecord,
    extraOutputs: fileRecord.extraOutputs
      ? Object.fromEntries(
          Object.entries(fileRecord.extraOutputs).map(
            ([name, output], index) => [
              name,
              {
                ...output,
                artifactPath:
                  output.contents != null
                    ? path.join(
                        fileDir,
                        envId,
                        "resources",
                        `${String(index).padStart(3, "0")}.bin`,
                      )
                    : output.artifactPath,
                mapArtifactPath: output.map
                  ? path.join(
                      fileDir,
                      envId,
                      "resources",
                      `${String(index).padStart(3, "0")}.map`,
                    )
                  : output.mapArtifactPath,
                contents: undefined,
                map: undefined,
              },
            ],
          ),
        )
      : undefined,
    cells: fileRecord.cells.map((cell, index) =>
      cell.kind === "generated"
        ? cell
        : {
            ...cell,
            artifactPath: path.join(
              fileDir,
              envId,
              toCellArtifactFileName(index),
            ),
            mapArtifactPath: cell.map
              ? path.join(
                  fileDir,
                  envId,
                  `${toCellArtifactFileName(index)}.map`,
                )
              : undefined,
            code: undefined,
            map: undefined,
          },
    ),
  };
}

function toCellArtifactFileName(index: number): string {
  return `${String(index).padStart(3, "0")}.js`;
}

async function writeFileCache(
  cachePaths: FileCachePaths,
  sourceResultsByEnv: Record<string, TransformResult>,
  fileRecordsByEnv: Record<string, FileRecord>,
  moduleKey: string,
  baseKey: string,
  dependencyRequestsByEnv: Record<string, WorkerImportRequest[]>,
  moduleIdentity: string,
  variants: ModuleVariantRecord[],
): Promise<void> {
  await fs.rm(cachePaths.fileDir, { recursive: true, force: true });
  await ensureDir(cachePaths.fileDir);
  await ensureDir(cachePaths.artifactDir);

  for (const variant of variants) {
    const representativeEnv = variant.environmentIds[0];
    const result = sourceResultsByEnv[representativeEnv];
    const fileRecord = variant.record;
    await ensureDir(path.join(cachePaths.artifactDir, variant.variantId));
    for (const [index, cell] of (result.fileRecord?.cells ?? []).entries()) {
      if (cell.kind === "generated") {
        continue;
      }
      const artifactPath = fileRecord.cells[index]?.artifactPath;
      if (!artifactPath) {
        continue;
      }
      if (!(await fileExists(artifactPath))) {
        await writeFileAtomic(artifactPath, cell.code ?? "");
      }
      const mapArtifactPath = fileRecord.cells[index]?.mapArtifactPath;
      if (mapArtifactPath && cell.map) {
        if (!(await fileExists(mapArtifactPath))) {
          await writeFileAtomic(mapArtifactPath, cell.map);
        }
      }
    }
    for (const [name, output] of Object.entries(
      result.fileRecord?.extraOutputs ?? {},
    )) {
      const cachedOutput = fileRecord.extraOutputs?.[name];
      if (cachedOutput?.artifactPath && output.contents != null) {
        if (!(await fileExists(cachedOutput.artifactPath))) {
          await writeFileAtomic(cachedOutput.artifactPath, output.contents);
        }
      }
      if (cachedOutput?.mapArtifactPath && output.map) {
        if (!(await fileExists(cachedOutput.mapArtifactPath))) {
          await writeFileAtomic(cachedOutput.mapArtifactPath, output.map);
        }
      }
    }
  }

  const moduleRecord: ModuleCacheRecord = {
    baseKey,
    moduleKey,
    dependencyRequestsByEnv,
    variants: variants.map((variant) => ({
      ...variant,
      record: toCachedFileRecord(
        variant.record,
        cachePaths.fileDir,
        moduleIdentity,
      ),
    })),
    fileRecordsByEnv: toCachedFileRecords(
      fileRecordsByEnv,
      cachePaths.fileDir,
      moduleIdentity,
    ),
  };
  await writeJsonAtomic(cachePaths.modulePath, moduleRecord);
}

async function readModuleCache(
  filePath: string,
): Promise<ModuleCacheRecord | null> {
  const parsed = await readJsonIfExists<
    Partial<ModuleCacheRecord> & {
      irHeader?: FileRecord;
      fileRecord?: FileRecord;
      cacheKey?: string;
    }
  >(filePath);
  if (!parsed) {
    return null;
  }

  const fileRecordsByEnv =
    parsed.fileRecordsByEnv ??
    (parsed.fileRecord || parsed.irHeader
      ? { default: (parsed.fileRecord ?? parsed.irHeader) as FileRecord }
      : null);
  const moduleKey = parsed.moduleKey ?? parsed.cacheKey;
  if (
    !moduleKey ||
    !parsed.baseKey ||
    !parsed.dependencyRequestsByEnv ||
    !fileRecordsByEnv
  ) {
    return null;
  }

  return {
    baseKey: parsed.baseKey,
    moduleKey,
    dependencyRequestsByEnv: parsed.dependencyRequestsByEnv,
    variants: parsed.variants,
    fileRecordsByEnv,
  };
}

async function readRemoteModuleCache(
  remote: RemoteCacheAdapter,
  cachePaths: FileCachePaths,
  baseKey: string,
  request: WorkerRequest,
): Promise<ModuleCacheRecord | null> {
  const raw = await remote.get(
    joinRemoteKey(cachePaths.remoteBaseKey, "module.json"),
  );
  if (!raw) {
    return null;
  }

  let parsed: ModuleCacheRecord | null = null;
  try {
    parsed = JSON.parse(raw) as ModuleCacheRecord;
  } catch {
    return null;
  }
  if (!parsed || !parsed.fileRecordsByEnv) {
    return null;
  }

  const validated = await validateCacheCandidate(parsed, request, baseKey);
  if (!validated) return null;

  const hydrated: ModuleCacheRecord = {
    ...validated,
    fileRecordsByEnv: hydrateCachedFileRecords(
      validated.fileRecordsByEnv,
      cachePaths.fileDir,
      request,
    ),
  };

  await fs.rm(cachePaths.fileDir, { recursive: true, force: true });
  await ensureDir(cachePaths.fileDir);
  await ensureDir(cachePaths.artifactDir);

  for (const fileRecord of Object.values(hydrated.fileRecordsByEnv)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated" || !cell.artifactPath) {
        continue;
      }
      const relativeArtifactPath = normalizePosixPath(
        path.relative(cachePaths.artifactDir, cell.artifactPath),
      );
      const artifact = await remote.get(
        joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeArtifactPath),
      );
      if (artifact == null) {
        return null;
      }
      await writeFileAtomic(cell.artifactPath, artifact);
      if (cell.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, cell.mapArtifactPath),
        );
        const sourceMap = await remote.get(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeMapPath),
        );
        if (sourceMap == null) {
          return null;
        }
        await writeFileAtomic(cell.mapArtifactPath, sourceMap);
      }
    }
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      if (output.artifactPath) {
        const relativePath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, output.artifactPath),
        );
        const encoded = await remote.get(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativePath),
        );
        if (encoded == null) {
          return null;
        }
        await writeFileAtomic(
          output.artifactPath,
          Buffer.from(encoded, "base64"),
        );
      }
      if (output.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, output.mapArtifactPath),
        );
        const sourceMap = await remote.get(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeMapPath),
        );
        if (sourceMap == null) {
          return null;
        }
        await writeFileAtomic(output.mapArtifactPath, sourceMap);
      }
    }
  }

  await writeJsonAtomic(cachePaths.modulePath, {
    ...hydrated,
    fileRecordsByEnv: toCachedFileRecords(
      hydrated.fileRecordsByEnv,
      cachePaths.fileDir,
      request.moduleIdentity,
    ),
  });
  if (!(await hasCachedArtifacts(hydrated.fileRecordsByEnv))) {
    return null;
  }
  return hydrated;
}

async function writeRemoteFileCache(
  remote: RemoteCacheAdapter,
  cachePaths: FileCachePaths,
  fileRecordsByEnv: Record<string, FileRecord>,
  moduleKey: string,
  baseKey: string,
  dependencyRequestsByEnv: Record<string, WorkerImportRequest[]>,
  moduleIdentity: string,
  variants: ModuleVariantRecord[],
): Promise<void> {
  const remoteRecord: ModuleCacheRecord = {
    baseKey,
    moduleKey,
    dependencyRequestsByEnv,
    variants: variants.map((variant) => ({
      ...variant,
      record: toCachedFileRecord(
        variant.record,
        cachePaths.fileDir,
        moduleIdentity,
      ),
    })),
    fileRecordsByEnv: toCachedFileRecords(
      fileRecordsByEnv,
      cachePaths.fileDir,
      moduleIdentity,
    ),
  };

  for (const fileRecord of variants.map((variant) => variant.record)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated" || !cell.artifactPath) {
        continue;
      }
      const relativeArtifactPath = normalizePosixPath(
        path.relative(cachePaths.artifactDir, cell.artifactPath),
      );
      const artifact = await fs.readFile(cell.artifactPath, "utf8");
      await remote.set(
        joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeArtifactPath),
        artifact,
      );
      if (cell.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, cell.mapArtifactPath),
        );
        await remote.set(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeMapPath),
          await fs.readFile(cell.mapArtifactPath, "utf8"),
        );
      }
    }
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      if (output.artifactPath) {
        const relativePath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, output.artifactPath),
        );
        const artifact = await fs.readFile(output.artifactPath);
        await remote.set(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativePath),
          artifact.toString("base64"),
        );
      }
      if (output.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.artifactDir, output.mapArtifactPath),
        );
        await remote.set(
          joinRemoteKey(cachePaths.remoteArtifactBaseKey, relativeMapPath),
          await fs.readFile(output.mapArtifactPath, "utf8"),
        );
      }
    }
  }

  await remote.set(
    joinRemoteKey(cachePaths.remoteBaseKey, "module.json"),
    JSON.stringify(remoteRecord),
  );
}

function hydrateCachedFileRecords(
  records: Record<string, FileRecord>,
  fileDir: string,
  request: WorkerRequest,
): Record<string, FileRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([envId, record]) => [
      envId,
      {
        ...record,
        id: request.id,
        filePath: request.realPath,
        pkg: request.pkg,
        extraOutputs: record.extraOutputs
          ? Object.fromEntries(
              Object.entries(record.extraOutputs).map(([name, output]) => [
                name,
                {
                  ...output,
                  artifactPath:
                    output.artifactPath && !path.isAbsolute(output.artifactPath)
                      ? path.join(fileDir, output.artifactPath)
                      : output.artifactPath,
                  mapArtifactPath:
                    output.mapArtifactPath &&
                    !path.isAbsolute(output.mapArtifactPath)
                      ? path.join(fileDir, output.mapArtifactPath)
                      : output.mapArtifactPath,
                },
              ]),
            )
          : undefined,
        cells: record.cells.map((cell) => ({
          ...cell,
          artifactPath:
            cell.artifactPath && !path.isAbsolute(cell.artifactPath)
              ? path.join(fileDir, cell.artifactPath)
              : cell.artifactPath,
          mapArtifactPath:
            cell.mapArtifactPath && !path.isAbsolute(cell.mapArtifactPath)
              ? path.join(fileDir, cell.mapArtifactPath)
              : cell.mapArtifactPath,
        })),
      },
    ]),
  );
}

function toCachedFileRecords(
  records: Record<string, FileRecord>,
  fileDir: string,
  moduleIdentity: string,
): Record<string, FileRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([envId, record]) => [
      envId,
      toCachedFileRecord(record, fileDir, moduleIdentity),
    ]),
  );
}

function toCachedFileRecord(
  record: FileRecord,
  fileDir: string,
  moduleIdentity: string,
): FileRecord {
  return {
    ...record,
    id: moduleIdentity,
    filePath: moduleIdentity,
    pkg: {
      name: record.pkg.name,
      version: record.pkg.version,
      root: ".",
    },
    extraOutputs: record.extraOutputs
      ? Object.fromEntries(
          Object.entries(record.extraOutputs).map(([name, output]) => [
            name,
            {
              ...output,
              artifactPath: output.artifactPath
                ? normalizePosixPath(
                    path.relative(fileDir, output.artifactPath),
                  )
                : undefined,
              mapArtifactPath: output.mapArtifactPath
                ? normalizePosixPath(
                    path.relative(fileDir, output.mapArtifactPath),
                  )
                : undefined,
            },
          ]),
        )
      : undefined,
    cells: record.cells.map((cell) => ({
      ...cell,
      artifactPath: cell.artifactPath
        ? normalizePosixPath(path.relative(fileDir, cell.artifactPath))
        : undefined,
      mapArtifactPath: cell.mapArtifactPath
        ? normalizePosixPath(path.relative(fileDir, cell.mapArtifactPath))
        : undefined,
    })),
  };
}

async function hasCachedArtifacts(
  fileRecordsByEnv: Record<string, FileRecord>,
): Promise<boolean> {
  for (const fileRecord of Object.values(fileRecordsByEnv)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated") {
        continue;
      }
      if (!cell.artifactPath) {
        return false;
      }
      if (!(await fileExists(cell.artifactPath))) {
        return false;
      }
      if (cell.mapArtifactPath && !(await fileExists(cell.mapArtifactPath))) {
        return false;
      }
    }
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      if (output.artifactPath && !(await fileExists(output.artifactPath))) {
        return false;
      }
      if (
        output.mapArtifactPath &&
        !(await fileExists(output.mapArtifactPath))
      ) {
        return false;
      }
    }
  }
  return true;
}

function requestCoordinator<T>(payload: unknown): Promise<T> {
  const requestId = nextCoordinatorRequestId;
  nextCoordinatorRequestId += 1;
  return new Promise<T>((resolve, reject) => {
    pendingCoordinatorRequests.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    parentPort?.postMessage({
      type: "coordinator-request",
      requestId,
      payload,
    });
  });
}

function isCoordinatorResponse(
  message: WorkerRequest | CoordinatorResponseMessage,
): message is CoordinatorResponseMessage {
  return "type" in message && message.type === "coordinator-response";
}

parentPort.on(
  "message",
  async (request: WorkerRequest | CoordinatorResponseMessage) => {
    if (isCoordinatorResponse(request)) {
      const pending = pendingCoordinatorRequests.get(request.requestId);
      if (!pending) {
        return;
      }
      pendingCoordinatorRequests.delete(request.requestId);
      if (request.error) {
        pending.reject(new Error(request.error));
      } else {
        pending.resolve(request.payload);
      }
      return;
    }

    try {
      await ensureDir(request.cacheDir);
      const response = await handleTransform(request);
      parentPort?.postMessage(response);
    } catch (error) {
      parentPort?.postMessage({ ok: false, error: (error as Error).message });
    }
  },
);
