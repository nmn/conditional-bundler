import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import path from "node:path";
import { filePrefix, contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  CellRecord,
  TransformResult,
  TransformMultiResult,
  FileRecord,
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

type WorkerRequest = {
  realPath: string;
  code: string;
  pkg: { name: string; version: string; root: string };
  envs: string[];
  cacheDir: string;
  syntax: { jsx: boolean; ts: boolean };
  codeByEnv?: Record<string, string>;
};

type WorkerResponse = {
  ok: boolean;
  cacheHit?: boolean;
  contentHash: string;
  prefix: string;
  fileRecord: FileRecord;
};

type ModuleCacheRecord = {
  moduleKey: string;
  fileRecord: FileRecord;
  createdAt: string;
  updatedAt: string;
};

type FileCachePaths = {
  fileHash: string;
  fileDir: string;
  modulePath: string;
};

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
    (await hasCachedArtifacts(cached.fileRecord))
  ) {
    return {
      ok: true,
      cacheHit: true,
      contentHash: cached.fileRecord.contentHash,
      prefix: cached.fileRecord.prefix,
      fileRecord: cached.fileRecord,
    };
  }

  const parsedByEnv = request.codeByEnv;
  const normalizedPath = normalizePosixPath(request.realPath);
  const relPath = path.posix.relative(request.pkg.root, normalizedPath);
  const prefix = filePrefix(request.pkg.name, request.pkg.version, relPath);

  const result = await transformFile(request, parsedByEnv);
  const resultsByEnv = (
    "code" in result ? { default: result } : result
  ) as TransformMultiResult;

  const first = Object.values(resultsByEnv)[0] as TransformResult;
  if (!first.fileRecord) {
    throw new Error("Transform result missing file record.");
  }

  const fileRecord = finalizeFileRecord(
    {
      ...first.fileRecord,
      id: request.realPath,
      prefix,
      contentHash: fileHash,
      envs: Object.keys(resultsByEnv),
      codeByEnv: {},
      mapByEnv: {},
      pkg: request.pkg,
    },
    cachePaths.fileDir,
  );

  await writeFileCache(cachePaths, first.fileRecord.cells, fileRecord, moduleKey);

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileHash,
    prefix,
    fileRecord,
  };
}

async function transformFile(
  request: WorkerRequest,
  overrideByEnv?: Record<string, string>,
): Promise<TransformResult | TransformMultiResult> {
  const { transformWithCore } = await import("./transform/core.js");
  if (overrideByEnv) {
    const results: TransformMultiResult = {};
    for (const [envId, code] of Object.entries(overrideByEnv)) {
      results[envId] = transformWithCore(
        {
          code,
          realPath: request.realPath,
          pkg: request.pkg,
          syntax: request.syntax,
          envs: request.envs,
        },
        {
          importAttrAllow: ["json"],
        },
      );
    }
    return results;
  }
  return transformWithCore(
    {
      code: request.code,
      realPath: request.realPath,
      pkg: request.pkg,
      syntax: request.syntax,
      envs: request.envs,
    },
    {
      importAttrAllow: ["json"],
    },
  );
}

function buildModuleKey(request: WorkerRequest): string {
  const envHashes = Object.fromEntries(
    Object.entries(request.codeByEnv ?? {}).map(([envId, code]) => [
      envId,
      contentHash(code),
    ]),
  );

  return JSON.stringify({
    realPath: normalizePosixPath(request.realPath),
    pkg: request.pkg,
    envs: [...request.envs].sort(),
    syntax: request.syntax,
    codeHash: contentHash(request.code),
    envHashes,
  });
}

function buildFileCachePaths(cacheRoot: string, realPath: string): FileCachePaths {
  const fileHash = contentHash(normalizePosixPath(realPath));
  const fileDir = path.join(cacheRoot, "files", fileHash);
  return {
    fileHash,
    fileDir,
    modulePath: path.join(fileDir, "module.json"),
  };
}

function finalizeFileRecord(fileRecord: FileRecord, fileDir: string): FileRecord {
  return {
    ...fileRecord,
    cells: fileRecord.cells.map((cell, index) =>
      cell.kind === "generated"
        ? cell
        : {
            ...cell,
            artifactPath: path.join(fileDir, toCellArtifactFileName(index)),
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
  sourceCells: CellRecord[],
  fileRecord: FileRecord,
  moduleKey: string,
): Promise<void> {
  const existing = await readModuleCache(cachePaths.modulePath);
  await fs.rm(cachePaths.fileDir, { recursive: true, force: true });
  await ensureDir(cachePaths.fileDir);

  for (const [index, cell] of sourceCells.entries()) {
    if (cell.kind === "generated") {
      continue;
    }
    const artifactPath = path.join(
      cachePaths.fileDir,
      toCellArtifactFileName(index),
    );
    await writeFileAtomic(artifactPath, cell.code ?? "");
  }

  const now = new Date().toISOString();
  const moduleRecord: ModuleCacheRecord = {
    moduleKey,
    fileRecord,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeJsonAtomic(cachePaths.modulePath, moduleRecord);
}

async function readModuleCache(
  filePath: string,
): Promise<ModuleCacheRecord | null> {
  const parsed = await readJsonIfExists<
    Partial<ModuleCacheRecord> & { irHeader?: FileRecord; cacheKey?: string }
  >(filePath);
  if (!parsed) {
    return null;
  }

  const fileRecord = parsed.fileRecord ?? parsed.irHeader;
  const moduleKey = parsed.moduleKey ?? parsed.cacheKey;
  if (!moduleKey || !fileRecord) {
    return null;
  }

  return {
    moduleKey,
    fileRecord,
    createdAt: parsed.createdAt ?? new Date(0).toISOString(),
    updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
  };
}

async function hasCachedArtifacts(fileRecord: FileRecord): Promise<boolean> {
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
