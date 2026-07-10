import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import remappingModule from "@ampproject/remapping";
import { filePrefix, contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  CellRecord,
  DiscoveredEntrypoint,
  ExtraTransformOutput,
  FileRecord,
  RemoteCacheConfig,
  TransformResult,
} from "@bundler/shared";
import {
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
  realPath: string;
  code: string;
  pkg: { name: string; version: string; root: string };
  envs: string[];
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
  workerProfile: WorkerTransformProfile;
  cacheOnly?: boolean;
  resolvedImportsByEnv?: Record<
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
  >;
  dev?: {
    hmr?: boolean;
  };
};

type WorkerResponse = {
  ok: boolean;
  cacheHit?: boolean;
  needsResolution?: boolean;
  unresolvedImportsByEnv?: Record<string, WorkerImportRequest[]>;
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
    | "conditional-else";
  request: string;
  importAttributes?: Record<string, string>;
};

type ModuleCacheRecord = {
  moduleKey: string;
  fileRecordsByEnv: Record<string, FileRecord>;
  createdAt: string;
  updatedAt: string;
};

type FileCachePaths = {
  fileHash: string;
  fileDir: string;
  modulePath: string;
  remoteBaseKey: string;
};

type RemoteCacheAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

const babelModuleCache = new Map<string, unknown>();
const CELL_ARTIFACT_FORMAT = 4;
const remapping = ((
  remappingModule as unknown as {
    default?: typeof import("@ampproject/remapping").default;
  }
).default ??
  remappingModule) as unknown as typeof import("@ampproject/remapping").default;

async function handleTransform(
  request: WorkerRequest,
): Promise<WorkerResponse> {
  const moduleKey = buildModuleKey(request);
  const fileHash = contentHash(request.code);
  const cachePaths = buildFileCachePaths(
    request.cacheDir,
    request.realPath,
    request.envs,
  );
  const remote = createRemoteCacheAdapter(
    request.remoteCache,
    request.cacheNamespace,
  );
  const cached = await readModuleCache(cachePaths.modulePath);
  if (
    cached &&
    cached.moduleKey === moduleKey &&
    (await hasCachedArtifacts(
      cached.fileRecordsByEnv,
      Boolean(request.sourceMap),
    ))
  ) {
    const first = Object.values(cached.fileRecordsByEnv)[0];
    return {
      ok: true,
      cacheHit: true,
      contentHash: first.contentHash,
      prefix: first.prefix,
      fileRecordsByEnv: cached.fileRecordsByEnv,
    };
  }
  const remoteCached = remote
    ? await readRemoteModuleCache(
        remote,
        cachePaths,
        moduleKey,
        Boolean(request.sourceMap),
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

  if (request.cacheOnly) {
    return {
      ok: true,
      cacheHit: false,
      needsResolution: true,
      contentHash: fileHash,
      prefix: "",
      fileRecordsByEnv: {},
    };
  }

  const normalizedPath = normalizePosixPath(request.realPath);
  const relPath = path.posix.relative(request.pkg.root, normalizedPath);
  const prefix = filePrefix(request.pkg.name, request.pkg.version, relPath);
  const resultsByEnv = await transformFile(request);
  const unresolvedImportsByEnv = collectUnresolvedImportsByEnv(
    resultsByEnv,
    request,
  );
  if (Object.keys(unresolvedImportsByEnv).length > 0) {
    return {
      ok: true,
      cacheHit: false,
      needsResolution: true,
      unresolvedImportsByEnv,
      contentHash: fileHash,
      prefix,
      fileRecordsByEnv: {},
    };
  }
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
            prefix,
            contentHash: contentHash(
              request.codeByEnv?.[envId] ?? request.code,
            ),
            envs: [envId],
            codeByEnv: {},
            mapByEnv: {},
            pkg: request.pkg,
          },
          cachePaths.fileDir,
          envId,
        ),
      ];
    }),
  ) as Record<string, FileRecord>;

  await writeFileCache(cachePaths, resultsByEnv, fileRecordsByEnv, moduleKey);
  if (remote) {
    await writeRemoteFileCache(remote, cachePaths, fileRecordsByEnv, moduleKey);
  }

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileRecordsByEnv[request.envs[0]]?.contentHash ?? fileHash,
    prefix,
    fileRecordsByEnv,
  };
}

function collectUnresolvedImportsByEnv(
  resultsByEnv: Record<string, TransformResult>,
  request: WorkerRequest,
): Record<string, WorkerImportRequest[]> {
  const unresolvedByEnv: Record<string, WorkerImportRequest[]> = {};

  for (const [envId, result] of Object.entries(resultsByEnv)) {
    const fileRecord = result.fileRecord;
    if (!fileRecord) {
      continue;
    }
    const resolved = request.resolvedImportsByEnv?.[envId] ?? {};
    const unresolved = new Map<string, WorkerImportRequest>();
    const add = (
      kind: WorkerImportRequest["kind"],
      importRequest: string,
      importAttributes?: Record<string, string>,
    ) => {
      const key = `${kind}:${importRequest}`;
      if (resolved[key]) {
        return;
      }
      unresolved.set(key, {
        key,
        kind,
        request: importRequest,
        importAttributes,
      });
    };

    for (const entry of fileRecord.imports) {
      add(
        entry.condition ? "conditional-import" : "import",
        entry.request ?? entry.source,
        entry.attributes ?? undefined,
      );
    }
    for (const entry of fileRecord.conditionalImports) {
      if (entry.elseSource) {
        add("conditional-else", entry.elseRequest ?? entry.elseSource);
      }
    }
    for (const entry of [
      ...fileRecord.exportStars,
      ...fileRecord.reexportsNamed,
    ]) {
      add("reexport", entry.request ?? entry.source);
    }
    for (const entry of fileRecord.dynamicImports) {
      add("dynamic-import", entry.request ?? entry.source);
    }

    if (unresolved.size > 0) {
      unresolvedByEnv[envId] = Array.from(unresolved.values());
    }
  }

  return unresolvedByEnv;
}

async function transformFile(
  request: WorkerRequest,
): Promise<Record<string, TransformResult>> {
  const { transformWithCore } = await import("./transform/core.js");
  const results: Record<string, TransformResult> = {};

  for (const envId of request.envs) {
    const initialCode = request.codeByEnv?.[envId] ?? request.code;
    const initialMap = request.mapByEnv?.[envId];
    const transformSpecs = [
      ...(request.workerProfile.transformPre[envId] ??
        request.workerProfile.transformPre.default ??
        []),
      ...(request.workerProfile.transform[envId] ??
        request.workerProfile.transform.default ??
        []),
    ];
    const preResult = await applyBabelStage(
      initialCode,
      initialMap,
      request,
      envId,
      transformSpecs,
    );
    const coreResult = transformWithCore(
      {
        id: request.id,
        code: preResult.code,
        realPath: request.realPath,
        pkg: request.pkg,
        syntax: request.syntax,
        envs: request.envs,
        envId,
        resolvedImports: request.resolvedImportsByEnv?.[envId],
        dev: request.dev,
      },
      {
        importAttrAllow: ["json"],
        sourceMap: request.sourceMap
          ? {
              sourceFileName: request.sourceMap.sourceFileName,
              sourcesContent: request.sourceMap.sourcesContent,
            }
          : undefined,
      },
    );
    const coreMap = composeSourceMaps(coreResult.map, preResult.map);
    const coreCells = (coreResult.fileRecord?.cells ?? []).map((cell) => ({
      ...cell,
      map: composeSourceMaps(cell.map, preResult.map),
    }));
    const postResult = await applyBabelStage(
      coreResult.code,
      coreMap,
      request,
      envId,
      request.workerProfile.transformPost[envId] ??
        request.workerProfile.transformPost.default ??
        [],
    );
    const postCells = coreResult.fileRecord
      ? await applyBabelStageToCells(
          coreCells,
          request,
          envId,
          request.workerProfile.transformPost[envId] ??
            request.workerProfile.transformPost.default ??
            [],
        )
      : [];
    const metadata = preResult.metadata as
      | {
          conditionalBundlerExtraOutputs?: Record<string, ExtraTransformOutput>;
          conditionalBundlerDiscoveredEntrypoints?: DiscoveredEntrypoint[];
        }
      | undefined;
    const extraOutputs = {
      ...(request.extraOutputsByEnv?.[envId] ?? {}),
      ...(coreResult.extraOutputs ?? {}),
      ...(metadata?.conditionalBundlerExtraOutputs ?? {}),
    };
    const discoveredEntrypoints = [
      ...(coreResult.fileRecord?.discoveredEntrypoints ?? []),
      ...(request.discoveredEntrypointsByEnv?.[envId] ?? []),
      ...(metadata?.conditionalBundlerDiscoveredEntrypoints ?? []),
    ];
    results[envId] = {
      ...coreResult,
      code: postResult.code,
      map: normalizeSourceMap(postResult.map, request),
      fileRecord: coreResult.fileRecord
        ? {
            ...coreResult.fileRecord,
            discoveredEntrypoints,
            extraOutputs:
              Object.keys(extraOutputs).length > 0 ? extraOutputs : undefined,
            cells: postCells.map((cell) => ({
              ...cell,
              map: normalizeSourceMap(cell.map, request),
            })),
          }
        : undefined,
    };
  }

  return results;
}

async function applyBabelStage(
  code: string,
  map: string | undefined,
  request: WorkerRequest,
  envId: string,
  specs: WorkerBabelPluginSpec[],
): Promise<{ code: string; map?: string; metadata?: Record<string, unknown> }> {
  if (specs.length === 0) {
    return { code, map };
  }
  const plugins = await Promise.all(
    specs.map(async (spec, index) => {
      const loaded = await loadBabelPlugin(spec.modulePath);
      return [
        loaded,
        {
          ...(spec.options ?? {}),
          envId,
          filePath: request.realPath,
          id: request.id,
          pkg: request.pkg,
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
): string | undefined {
  if (!generatedMap) {
    return undefined;
  }
  if (!inputMap) {
    return generatedMap;
  }
  const maps = [
    JSON.parse(generatedMap),
    JSON.parse(inputMap),
  ] as unknown as Parameters<typeof remapping>[0];
  return JSON.stringify(remapping(maps, () => null));
}

function normalizeSourceMap(
  map: string | undefined,
  request: WorkerRequest,
): string | undefined {
  if (!map || !request.sourceMap) {
    return undefined;
  }
  const parsed = JSON.parse(map) as Record<string, unknown>;
  normalizeSourceMapObject(parsed, request);
  return JSON.stringify(parsed);
}

function normalizeSourceMapObject(
  map: Record<string, unknown>,
  request: WorkerRequest,
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
  if (!request.sourceMap?.sourcesContent) {
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

function buildModuleKey(request: WorkerRequest): string {
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
              contents: output.contents,
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
    id: request.id,
    realPath: normalizePosixPath(request.realPath),
    pkg: request.pkg,
    envs: [...request.envs].sort(),
    syntax: request.syntax,
    codeHash: contentHash(request.code),
    envHashes,
    mapHashes,
    sourceMap: request.sourceMap,
    extraOutputHashes,
    workerProfile: request.workerProfile.fingerprint,
  });
}

function buildFileCachePaths(
  cacheRoot: string,
  realPath: string,
  envs: string[],
): FileCachePaths {
  const fileHash = contentHash(normalizePosixPath(realPath));
  const envHash = contentHash(JSON.stringify([...envs].sort())).slice(0, 12);
  const fileDir = path.join(cacheRoot, "files", fileHash, envHash);
  return {
    fileHash,
    fileDir,
    modulePath: path.join(fileDir, "module.json"),
    remoteBaseKey: joinRemoteKey("files", fileHash, envHash),
  };
}

function finalizeFileRecord(
  fileRecord: FileRecord,
  fileDir: string,
  envId: string,
): FileRecord {
  return {
    ...fileRecord,
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
): Promise<void> {
  const existing = await readModuleCache(cachePaths.modulePath);
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
  }

  const now = new Date().toISOString();
  const moduleRecord: ModuleCacheRecord = {
    moduleKey,
    fileRecordsByEnv,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
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
  if (!moduleKey || !fileRecordsByEnv) {
    return null;
  }

  return {
    moduleKey,
    fileRecordsByEnv,
    createdAt: parsed.createdAt ?? new Date(0).toISOString(),
    updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
  };
}

async function readRemoteModuleCache(
  remote: RemoteCacheAdapter,
  cachePaths: FileCachePaths,
  moduleKey: string,
  sourceMapsRequired: boolean,
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
  if (!parsed || parsed.moduleKey !== moduleKey || !parsed.fileRecordsByEnv) {
    return null;
  }

  const hydrated: ModuleCacheRecord = {
    ...parsed,
    fileRecordsByEnv: hydrateRemoteFileRecords(
      parsed.fileRecordsByEnv,
      cachePaths.fileDir,
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
  }

  await writeJsonAtomic(cachePaths.modulePath, hydrated);
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
): Promise<void> {
  const local = await readModuleCache(cachePaths.modulePath);
  const now = new Date().toISOString();
  const remoteRecord: ModuleCacheRecord = {
    moduleKey,
    fileRecordsByEnv: toRemoteFileRecords(fileRecordsByEnv, cachePaths.fileDir),
    createdAt: local?.createdAt ?? now,
    updatedAt: now,
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
  }

  await remote.set(
    joinRemoteKey(cachePaths.remoteBaseKey, "module.json"),
    JSON.stringify(remoteRecord),
  );
}

function hydrateRemoteFileRecords(
  records: Record<string, FileRecord>,
  fileDir: string,
): Record<string, FileRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([envId, record]) => [
      envId,
      {
        ...record,
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

function toRemoteFileRecords(
  records: Record<string, FileRecord>,
  fileDir: string,
): Record<string, FileRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([envId, record]) => [
      envId,
      {
        ...record,
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

function createRemoteCacheAdapter(
  config: RemoteCacheConfig | undefined,
  namespace = "default",
): RemoteCacheAdapter | null {
  if (!config) {
    return null;
  }
  const prefix = joinRemoteKey(config.prefix, namespace);
  if (config.kind === "file") {
    return {
      async get(key) {
        try {
          return await fs.readFile(path.join(config.dir, prefix, key), "utf8");
        } catch {
          return null;
        }
      },
      async set(key, value) {
        await writeFileAtomic(path.join(config.dir, prefix, key), value);
      },
    };
  }
  if (config.kind === "cloudflare-kv") {
    const token = process.env[config.apiTokenEnv];
    if (!token) {
      throw new Error(
        `Cloudflare KV cache token env '${config.apiTokenEnv}' is not set.`,
      );
    }
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      config.accountId,
    )}/storage/kv/namespaces/${encodeURIComponent(config.namespaceId)}/values`;
    return {
      async get(key) {
        const response = await fetch(
          `${baseUrl}/${encodeURIComponent(joinRemoteKey(prefix, key))}`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        );
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(
            `Cloudflare KV cache read failed (${response.status}).`,
          );
        }
        return response.text();
      },
      async set(key, value) {
        const response = await fetch(
          `${baseUrl}/${encodeURIComponent(joinRemoteKey(prefix, key))}`,
          {
            method: "PUT",
            headers: { authorization: `Bearer ${token}` },
            body: value,
          },
        );
        if (!response.ok) {
          throw new Error(
            `Cloudflare KV cache write failed (${response.status}).`,
          );
        }
      },
    };
  }
  return null;
}

function joinRemoteKey(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .join("/");
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
  }
  return true;
}

parentPort.on("message", async (request: WorkerRequest) => {
  try {
    await ensureDir(request.cacheDir);
    const response = await handleTransform(request);
    parentPort?.postMessage(response);
  } catch (error) {
    parentPort?.postMessage({ ok: false, error: (error as Error).message });
  }
});
