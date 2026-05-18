import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import { filePrefix, contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  CellRecord,
  DiscoveredEntrypoint,
  ExtraTransformOutput,
  FileRecord,
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
  syntax: { jsx: boolean; ts: boolean };
  codeByEnv?: Record<string, string>;
  mapByEnv?: Record<string, string>;
  discoveredEntrypointsByEnv?: Record<string, DiscoveredEntrypoint[]>;
  extraOutputsByEnv?: Record<string, Record<string, ExtraTransformOutput>>;
  workerProfile: WorkerTransformProfile;
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
};

type WorkerResponse = {
  ok: boolean;
  cacheHit?: boolean;
  contentHash: string;
  prefix: string;
  fileRecordsByEnv: Record<string, FileRecord>;
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
};

const babelModuleCache = new Map<string, unknown>();

async function handleTransform(
  request: WorkerRequest,
): Promise<WorkerResponse> {
  const moduleKey = buildModuleKey(request);
  const fileHash = contentHash(request.code);
  const cachePaths = buildFileCachePaths(request.cacheDir, request.realPath);
  const cached = await readModuleCache(cachePaths.modulePath);
  if (
    cached &&
    cached.moduleKey === moduleKey &&
    (await hasCachedArtifacts(cached.fileRecordsByEnv))
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

  const normalizedPath = normalizePosixPath(request.realPath);
  const relPath = path.posix.relative(request.pkg.root, normalizedPath);
  const prefix = filePrefix(request.pkg.name, request.pkg.version, relPath);
  const resultsByEnv = await transformFile(request);
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

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileRecordsByEnv[request.envs[0]]?.contentHash ?? fileHash,
    prefix,
    fileRecordsByEnv,
  };
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
      },
      {
        importAttrAllow: ["json"],
      },
    );
    const postResult = await applyBabelStage(
      coreResult.code,
      coreResult.map,
      request,
      envId,
      request.workerProfile.transformPost[envId] ??
        request.workerProfile.transformPost.default ??
        [],
    );
    const postCells = coreResult.fileRecord
      ? await applyBabelStageToCells(
          coreResult.fileRecord.cells,
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
      map: postResult.map,
      fileRecord: coreResult.fileRecord
        ? {
            ...coreResult.fileRecord,
            discoveredEntrypoints,
            extraOutputs:
              Object.keys(extraOutputs).length > 0 ? extraOutputs : undefined,
            cells: postCells,
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
    sourceMaps: true,
    inputSourceMap: map ? JSON.parse(map) : undefined,
    plugins,
  });
  return {
    code: result?.code ?? code,
    map: result?.map ? JSON.stringify(result.map) : map,
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
      undefined,
      request,
      envId,
      specs,
    );
    transformed.push({
      ...cell,
      code: result.code,
    });
  }
  return transformed;
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
    id: request.id,
    realPath: normalizePosixPath(request.realPath),
    pkg: request.pkg,
    envs: [...request.envs].sort(),
    syntax: request.syntax,
    codeHash: contentHash(request.code),
    envHashes,
    mapHashes,
    extraOutputHashes,
    workerProfile: request.workerProfile.fingerprint,
    resolvedImportsByEnv: request.resolvedImportsByEnv,
  });
}

function buildFileCachePaths(
  cacheRoot: string,
  realPath: string,
): FileCachePaths {
  const fileHash = contentHash(normalizePosixPath(realPath));
  const fileDir = path.join(cacheRoot, "files", fileHash);
  return {
    fileHash,
    fileDir,
    modulePath: path.join(fileDir, "module.json"),
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
            code: undefined,
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
