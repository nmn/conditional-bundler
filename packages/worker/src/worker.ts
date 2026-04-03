import { parentPort } from "node:worker_threads";
import path from "node:path";
import { filePrefix, contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  TransformResult,
  TransformMultiResult,
  FileRecord,
} from "@bundler/shared";
import {
  writeFileAtomic,
  ensureDir,
  readFileIfExists,
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

type CacheRecord = {
  cacheKey: string;
  fileRecord: FileRecord;
};

async function handleTransform(
  request: WorkerRequest,
): Promise<WorkerResponse> {
  const fileHash = contentHash(request.code);
  const cacheKey = buildCacheKey(request);
  const recordPath = path.join(
    request.cacheDir,
    "records",
    `${contentHash(normalizePosixPath(request.realPath))}.json`,
  );
  const cached = await readCacheRecord(recordPath);
  if (
    cached &&
    cached.fileRecord &&
    cached.cacheKey === cacheKey &&
    (await hasCachedArtifacts())
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
  const artifactHash = contentHash(cacheKey);

  const result = await transformFile(request, parsedByEnv);
  const resultsByEnv = (
    "code" in result ? { default: result } : result
  ) as TransformMultiResult;

  const first = Object.values(resultsByEnv)[0] as TransformResult;
  if (!first.fileRecord) {
    throw new Error("Transform result missing file record.");
  }

  const fileRecord = {
    ...first.fileRecord,
    id: request.realPath,
    prefix,
    contentHash: fileHash,
    envs: Object.keys(resultsByEnv),
    codeByEnv: {},
    mapByEnv: {},
    pkg: request.pkg,
  };

  const irPath = path.join(request.cacheDir, "ir", `${artifactHash}.json`);
  const record: CacheRecord = {
    cacheKey,
    fileRecord,
  };
  await writeFileAtomic(irPath, JSON.stringify({ ...fileRecord }, null, 2));
  await writeFileAtomic(recordPath, JSON.stringify(record, null, 2));

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

function buildCacheKey(request: WorkerRequest): string {
  const envHashes = Object.fromEntries(
    Object.entries(request.codeByEnv ?? {}).map(([envId, code]) => [
      envId,
      contentHash(code),
    ]),
  );

  return JSON.stringify({
    realPath: normalizePosixPath(request.realPath),
    pkgRoot: request.pkg.root,
    envs: [...request.envs].sort(),
    syntax: request.syntax,
    codeHash: contentHash(request.code),
    envHashes,
  });
}

async function readCacheRecord(filePath: string): Promise<CacheRecord | null> {
  const raw = await readFileIfExists(filePath);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CacheRecord> & {
      irHeader?: FileRecord;
    };
    const fileRecord = parsed.fileRecord ?? parsed.irHeader;
    if (!parsed.cacheKey || !fileRecord) {
      return null;
    }
    return {
      cacheKey: parsed.cacheKey,
      fileRecord,
    };
  } catch {
    return null;
  }
}

async function hasCachedArtifacts(): Promise<boolean> {
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
