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

type WorkerTransformProfile = {
  fingerprint: string;
  transform: Record<string, WorkerBabelPluginSpec[]>;
  transformPre: Record<string, WorkerBabelPluginSpec[]>;
  transformPost: Record<string, WorkerBabelPluginSpec[]>;
};

type WorkerRequest = {
  id: string;
  moduleIdentity: string;
  realPath: string;
  code: string;
  sourceBytes?: Uint8Array;
  moduleType?: "javascript" | "css" | "asset";
  importIntent?: "module" | "url" | "raw" | "base64" | "assetPath";
  canonicalPath?: string;
  resolutionMeta?: Record<string, unknown>;
  buildMode?: string;
  transformConfig?: Record<string, unknown>;
  pkg: { name: string; version: string; root: string };
  envs: string[];
  targets: Record<string, "node" | "browser">;
  cacheDir: string;
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
      intent: "module" | "url" | "raw" | "base64" | "assetPath";
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
  modulePath: string;
  remoteBaseKey: string;
};

const babelModuleCache = new Map<string, unknown>();
const pendingCoordinatorRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let nextCoordinatorRequestId = 1;
const CELL_ARTIFACT_FORMAT = 19;
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
    (await hasCachedArtifacts(
      validatedCached.fileRecordsByEnv,
      Boolean(request.sourceMap),
    ))
  ) {
    const first = Object.values(validatedCached.fileRecordsByEnv)[0];
    return {
      ok: true,
      cacheHit: true,
      contentHash: first.contentHash,
      prefix: first.prefix,
      fileRecordsByEnv: validatedCached.fileRecordsByEnv,
    };
  }
  const remoteCached = remote
    ? await readRemoteModuleCache(
        remote,
        cachePaths,
        baseKey,
        Boolean(request.sourceMap),
        request,
      )
    : null;
  if (remoteCached) {
    const first = Object.values(remoteCached.fileRecordsByEnv)[0];
    return {
      ok: true,
      cacheHit: true,
      contentHash: first.contentHash,
      prefix: first.prefix,
      fileRecordsByEnv: remoteCached.fileRecordsByEnv,
    };
  }

  const transformed = await transformFile(request);
  const resultsByEnv = transformed.resultsByEnv;
  const moduleKey = buildModuleKey(baseKey, transformed.resolvedImportsByEnv);
  const fileRecordsByEnv = Object.fromEntries(
    Object.entries(resultsByEnv).map(([envId, result]) => {
      if (!result.fileRecord) {
        throw new Error(
          `Transform result missing file record for env '${envId}'.`,
        );
      }
      return [
        envId,
        finalizeFileRecord(
          {
            ...result.fileRecord,
            id: request.id,
            filePath: request.realPath,
            prefix: result.fileRecord.prefix,
            contentHash: contentHash(
              request.codeByEnv?.[envId] ?? sourceContent,
            ),
            envs: [envId],
            codeByEnv: {},
            mapByEnv: {},
            pkg: request.pkg,
            resolutionMeta: request.resolutionMeta,
          },
          cachePaths.fileDir,
          envId,
        ),
      ];
    }),
  ) as Record<string, FileRecord>;

  await writeFileCache(
    cachePaths,
    resultsByEnv,
    fileRecordsByEnv,
    moduleKey,
    baseKey,
    transformed.dependencyRequestsByEnv,
    request.moduleIdentity,
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
    );
  }

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileRecordsByEnv[request.envs[0]]?.contentHash ?? fileHash,
    prefix: fileRecordsByEnv[request.envs[0]]?.prefix ?? "",
    fileRecordsByEnv,
  };
}

async function transformFile(
  request: WorkerRequest,
): Promise<TransformFileOutput> {
  if (request.moduleType === "asset") {
    return {
      resultsByEnv: await transformAssetFile(request),
      dependencyRequestsByEnv: {},
      resolvedImportsByEnv: {},
    };
  }
  if (request.moduleType === "css") {
    return transformCssFile(request);
  }
  const { prepareCoreTransform, transformWithCore } =
    await import("./transform/core.js");
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
  const preResultCache = new Map<
    string,
    Awaited<ReturnType<typeof applyBabelStage>>
  >();
  const preparedCache = new Map<
    string,
    ReturnType<typeof prepareCoreTransform>
  >();
  const preparedKeysByEnv: Record<string, string> = {};
  const transformSpecsByEnv = Object.fromEntries(
    request.envs.map((envId) => [
      envId,
      [
        ...(request.workerProfile.transformPre[envId] ??
          request.workerProfile.transformPre.default ??
          []),
        ...(request.workerProfile.transform[envId] ??
          request.workerProfile.transform.default ??
          []),
      ],
    ]),
  ) as Record<string, WorkerBabelPluginSpec[]>;
  const transformSpecKeysByEnv = Object.fromEntries(
    Object.entries(transformSpecsByEnv).map(([envId, specs]) => [
      envId,
      JSON.stringify(specs),
    ]),
  ) as Record<string, string>;

  for (const envId of request.envs) {
    const initialCode = request.codeByEnv?.[envId] ?? request.code;
    const initialMap = request.mapByEnv?.[envId];
    const transformSpecs = transformSpecsByEnv[envId];
    const canReusePreTransform = transformSpecs.every((spec) =>
      isEnvironmentIndependentSpec(spec, request, initialCode),
    );
    const preCacheKey = canReusePreTransform
      ? JSON.stringify({
          codeHash: contentHash(initialCode),
          mapHash: initialMap ? contentHash(initialMap) : null,
          specs: transformSpecKeysByEnv[envId],
        })
      : `env:${envId}`;
    let preResult = preResultCache.get(preCacheKey);
    if (!preResult) {
      preResult = await applyBabelStage(
        initialCode,
        initialMap,
        request,
        envId,
        transformSpecs,
      );
      preResultCache.set(preCacheKey, preResult);
    }
    preResults[envId] = preResult;
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
  for (const envId of request.envs) {
    const preResult = preResults[envId];
    const coreCacheKey = JSON.stringify({
      preparedKey: preparedKeysByEnv[envId],
      resolvedImports: resolvedImportsByEnv[envId] ?? {},
    });
    let coreResult = coreResultCache.get(coreCacheKey);
    if (!coreResult) {
      coreResult = transformWithCore(
        {
          id: request.id,
          moduleIdentity: request.moduleIdentity,
          canonicalPath: request.canonicalPath ?? request.moduleIdentity,
          code: preResult.code,
          realPath: request.realPath,
          pkg: request.pkg,
          syntax: request.syntax,
          envs: request.envs,
          envId,
          resolvedImports: resolvedImportsByEnv[envId],
          dev: request.dev,
        },
        {
          importAttrAllow: ["json", "url", "raw", "base64", "assetPath"],
          generateModuleOutput: false,
          sourceMap: request.sourceMap
            ? {
                sourceFileName: request.sourceMap.sourceFileName,
                sourcesContent: request.sourceMap.sourcesContent,
                embedCellSourcesContent: false,
              }
            : undefined,
        },
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
    const postSpecs =
      request.workerProfile.transformPost[envId] ??
      request.workerProfile.transformPost.default ??
      [];
    const postCells = coreResult.fileRecord
      ? await applyBabelStageToCells(coreCells, request, envId, postSpecs)
      : [];
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

async function transformAssetFile(
  request: WorkerRequest,
): Promise<Record<string, TransformResult>> {
  const { transformAsset } = await import("./transform/asset.js");
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
  const intent =
    request.importIntent === "module" ? "url" : request.importIntent;
  if (
    intent !== "url" &&
    intent !== "raw" &&
    intent !== "base64" &&
    intent !== "assetPath"
  ) {
    throw new Error(`Unsupported asset intent '${String(intent)}'.`);
  }
  return Object.fromEntries(
    request.envs.map((envId) => [
      envId,
      transformAsset({
        id: request.id,
        moduleIdentity: request.moduleIdentity,
        canonicalPath: request.canonicalPath ?? request.moduleIdentity,
        realPath: request.realPath,
        bytes,
        intent,
        assetId,
        pkg: request.pkg,
        envs: request.envs,
        envId,
        dev: request.dev,
      }),
    ]),
  );
}

async function transformCssFile(
  request: WorkerRequest,
): Promise<TransformFileOutput> {
  const { analyzeCss, finalizeCssTransform } =
    await import("./transform/css.js");
  const analyses: Record<string, ReturnType<typeof analyzeCss>> = {};
  const requestsByEnv: Record<string, WorkerImportRequest[]> = {};
  for (const envId of request.envs) {
    const analysis = analyzeCss({
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
      dev: request.dev,
    });
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
          dev: request.dev,
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
  envId: string,
  specs: WorkerBabelPluginSpec[],
): Promise<{ code: string; map?: string; metadata?: Record<string, unknown> }> {
  const applicableSpecs = specs.filter(
    (spec) =>
      spec.options?.__bundlerExcludeNodeModules !== true ||
      !isNodeModulesPath(request.realPath),
  );
  if (applicableSpecs.length === 0) {
    return { code, map };
  }
  const plugins = await Promise.all(
    applicableSpecs.map(async (spec, index) => {
      const loaded = await loadBabelPlugin(spec.modulePath);
      const pluginOptions = { ...(spec.options ?? {}) };
      delete pluginOptions.__bundlerExcludeNodeModules;
      delete pluginOptions.__bundlerEnvironmentIndependent;
      delete pluginOptions.__bundlerEnvironmentIndependentUnlessCommonJs;
      delete pluginOptions.__bundlerEnvironmentIndependentUnlessModulePaths;
      return [
        loaded,
        {
          ...pluginOptions,
          envId,
          envs: request.envs,
          filePath: request.realPath,
          id: request.id,
          moduleIdentity: request.moduleIdentity,
          target: request.targets[envId] ?? "browser",
          buildMode: request.buildMode ?? "development",
          pkg: request.pkg,
          format: request.resolutionMeta?.format,
          reactCjsEnv: request.resolutionMeta?.reactCjsEnv,
        },
        `${envId}:${index}:${spec.modulePath}`,
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
        ...(request.syntax.ts ? ["typescript"] : []),
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

function isEnvironmentIndependentSpec(
  spec: WorkerBabelPluginSpec,
  request: WorkerRequest,
  code: string,
): boolean {
  if (spec.options?.__bundlerEnvironmentIndependent === true) {
    return true;
  }
  return (
    (spec.options?.__bundlerEnvironmentIndependentUnlessCommonJs === true &&
      request.resolutionMeta?.format !== "commonjs") ||
    (spec.options?.__bundlerEnvironmentIndependentUnlessModulePaths === true &&
      !/\b(?:__dirname|__filename)\b|import\.meta/.test(code))
  );
}

function isNodeModulesPath(filePath: string): boolean {
  return normalizePosixPath(filePath).split("/").includes("node_modules");
}

async function applyBabelStageToCells(
  cells: CellRecord[],
  request: WorkerRequest,
  envId: string,
  specs: WorkerBabelPluginSpec[],
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
    const result = await applyBabelStage(
      cell.code,
      cell.map,
      request,
      envId,
      specs,
    );
    transformed.push({
      ...cell,
      code: result.code,
      map: result.map,
    });
  }
  return transformed;
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
    envs: [...request.envs].sort(),
    targets: Object.fromEntries(
      Object.entries(request.targets).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    syntax: request.syntax,
    codeHash: contentHash(request.sourceBytes ?? request.code),
    moduleType: request.moduleType ?? "javascript",
    importIntent: request.importIntent ?? "module",
    canonicalPath: request.canonicalPath ?? request.moduleIdentity,
    buildMode: request.buildMode ?? "development",
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
                intent: value.intent,
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
    modulePath: path.join(fileDir, "module.json"),
    remoteBaseKey: joinRemoteKey("files", fileHash, variantHash),
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
): Promise<void> {
  await fs.rm(cachePaths.fileDir, { recursive: true, force: true });
  await ensureDir(cachePaths.fileDir);

  for (const [envId, result] of Object.entries(sourceResultsByEnv)) {
    const fileRecord = fileRecordsByEnv[envId];
    await ensureDir(path.join(cachePaths.fileDir, envId));
    for (const [index, cell] of (result.fileRecord?.cells ?? []).entries()) {
      if (cell.kind === "generated") {
        continue;
      }
      const artifactPath = fileRecord.cells[index]?.artifactPath;
      if (!artifactPath) {
        continue;
      }
      await writeFileAtomic(artifactPath, cell.code ?? "");
      const mapArtifactPath = fileRecord.cells[index]?.mapArtifactPath;
      if (mapArtifactPath && cell.map) {
        await writeFileAtomic(mapArtifactPath, cell.map);
      }
    }
    for (const [name, output] of Object.entries(
      result.fileRecord?.extraOutputs ?? {},
    )) {
      const cachedOutput = fileRecord.extraOutputs?.[name];
      if (cachedOutput?.artifactPath && output.contents != null) {
        await writeFileAtomic(cachedOutput.artifactPath, output.contents);
      }
      if (cachedOutput?.mapArtifactPath && output.map) {
        await writeFileAtomic(cachedOutput.mapArtifactPath, output.map);
      }
    }
  }

  const moduleRecord: ModuleCacheRecord = {
    baseKey,
    moduleKey,
    dependencyRequestsByEnv,
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
    fileRecordsByEnv,
  };
}

async function readRemoteModuleCache(
  remote: RemoteCacheAdapter,
  cachePaths: FileCachePaths,
  baseKey: string,
  sourceMapsRequired: boolean,
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

  for (const fileRecord of Object.values(hydrated.fileRecordsByEnv)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated" || !cell.artifactPath) {
        continue;
      }
      const relativeArtifactPath = normalizePosixPath(
        path.relative(cachePaths.fileDir, cell.artifactPath),
      );
      const artifact = await remote.get(
        joinRemoteKey(cachePaths.remoteBaseKey, relativeArtifactPath),
      );
      if (artifact == null) {
        return null;
      }
      await writeFileAtomic(cell.artifactPath, artifact);
      if (cell.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.fileDir, cell.mapArtifactPath),
        );
        const sourceMap = await remote.get(
          joinRemoteKey(cachePaths.remoteBaseKey, relativeMapPath),
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
          path.relative(cachePaths.fileDir, output.artifactPath),
        );
        const encoded = await remote.get(
          joinRemoteKey(cachePaths.remoteBaseKey, relativePath),
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
          path.relative(cachePaths.fileDir, output.mapArtifactPath),
        );
        const sourceMap = await remote.get(
          joinRemoteKey(cachePaths.remoteBaseKey, relativeMapPath),
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
  if (
    !(await hasCachedArtifacts(hydrated.fileRecordsByEnv, sourceMapsRequired))
  ) {
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
): Promise<void> {
  const remoteRecord: ModuleCacheRecord = {
    baseKey,
    moduleKey,
    dependencyRequestsByEnv,
    fileRecordsByEnv: toCachedFileRecords(
      fileRecordsByEnv,
      cachePaths.fileDir,
      moduleIdentity,
    ),
  };

  for (const fileRecord of Object.values(fileRecordsByEnv)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated" || !cell.artifactPath) {
        continue;
      }
      const relativeArtifactPath = normalizePosixPath(
        path.relative(cachePaths.fileDir, cell.artifactPath),
      );
      const artifact = await fs.readFile(cell.artifactPath, "utf8");
      await remote.set(
        joinRemoteKey(cachePaths.remoteBaseKey, relativeArtifactPath),
        artifact,
      );
      if (cell.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.fileDir, cell.mapArtifactPath),
        );
        await remote.set(
          joinRemoteKey(cachePaths.remoteBaseKey, relativeMapPath),
          await fs.readFile(cell.mapArtifactPath, "utf8"),
        );
      }
    }
    for (const output of Object.values(fileRecord.extraOutputs ?? {})) {
      if (output.artifactPath) {
        const relativePath = normalizePosixPath(
          path.relative(cachePaths.fileDir, output.artifactPath),
        );
        const artifact = await fs.readFile(output.artifactPath);
        await remote.set(
          joinRemoteKey(cachePaths.remoteBaseKey, relativePath),
          artifact.toString("base64"),
        );
      }
      if (output.mapArtifactPath) {
        const relativeMapPath = normalizePosixPath(
          path.relative(cachePaths.fileDir, output.mapArtifactPath),
        );
        await remote.set(
          joinRemoteKey(cachePaths.remoteBaseKey, relativeMapPath),
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
      {
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
      },
    ]),
  );
}

async function hasCachedArtifacts(
  fileRecordsByEnv: Record<string, FileRecord>,
  sourceMapsRequired = false,
): Promise<boolean> {
  for (const fileRecord of Object.values(fileRecordsByEnv)) {
    for (const cell of fileRecord.cells) {
      if (cell.kind === "generated") {
        continue;
      }
      if (!cell.artifactPath) {
        return false;
      }
      if (
        sourceMapsRequired &&
        cell.kind === "worker" &&
        !cell.mapArtifactPath
      ) {
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
