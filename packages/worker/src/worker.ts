import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import path from "node:path";
import { filePrefix, contentHash, normalizePosixPath } from "@bundler/shared";
import type {
  TransformInput,
  TransformResult,
  TransformMultiResult,
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
  irHeader: {
    id: string;
    prefix: string;
    contentHash: string;
    envs: string[];
    codeByEnv: Record<string, string>;
    mapByEnv: Record<string, string>;
    pkg: TransformInput["pkg"];
    imports: NonNullable<TransformResult["meta"]>["imports"];
    reexportsNamed: NonNullable<TransformResult["meta"]>["reexportsNamed"];
    exportStars: NonNullable<TransformResult["meta"]>["exportStars"];
    exportsLocal: NonNullable<TransformResult["meta"]>["exportsLocal"];
    flags: NonNullable<TransformResult["meta"]>["flags"];
    dynamicImports: NonNullable<TransformResult["meta"]>["dynamicImports"];
    conditionalImports: NonNullable<
      TransformResult["meta"]
    >["conditionalImports"];
    discoveredEntrypoints: NonNullable<
      TransformResult["meta"]
    >["discoveredEntrypoints"];
    importRanges: NonNullable<TransformResult["meta"]>["importRanges"];
    exportRanges: NonNullable<TransformResult["meta"]>["exportRanges"];
  };
};

type CacheRecord = {
  cacheKey: string;
  irHeader: WorkerResponse["irHeader"];
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
    cached.cacheKey === cacheKey &&
    (await hasCachedArtifacts(cached.irHeader))
  ) {
    return {
      ok: true,
      cacheHit: true,
      contentHash: cached.irHeader.contentHash,
      prefix: cached.irHeader.prefix,
      irHeader: cached.irHeader,
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

  const codeByEnv: Record<string, string> = {};
  const mapByEnv: Record<string, string> = {};

  for (const [envId, envResult] of Object.entries(resultsByEnv)) {
    const envTransform = envResult as TransformResult;
    const codePath = path.join(
      request.cacheDir,
      "code",
      `${artifactHash}.${envId}.js`,
    );
    const mapPath = envTransform.map
      ? path.join(request.cacheDir, "map", `${artifactHash}.${envId}.map`)
      : undefined;
    await writeFileAtomic(codePath, envTransform.code);
    if (mapPath && envTransform.map) {
      await writeFileAtomic(mapPath, envTransform.map);
      mapByEnv[envId] = mapPath;
    }
    codeByEnv[envId] = codePath;
  }

  const first = Object.values(resultsByEnv)[0] as TransformResult;
  if (!first.meta) {
    throw new Error("Transform result missing metadata.");
  }

  const irHeader = {
    id: request.realPath,
    prefix,
    contentHash: fileHash,
    envs: Object.keys(resultsByEnv),
    codeByEnv,
    mapByEnv,
    pkg: request.pkg,
    imports: first.meta.imports,
    reexportsNamed: first.meta.reexportsNamed,
    exportStars: first.meta.exportStars,
    exportsLocal: first.meta.exportsLocal,
    flags: first.meta.flags,
    dynamicImports: first.meta.dynamicImports,
    conditionalImports: first.meta.conditionalImports,
    discoveredEntrypoints: first.meta.discoveredEntrypoints,
    importRanges: first.meta.importRanges,
    exportRanges: first.meta.exportRanges,
  };

  const irPath = path.join(request.cacheDir, "ir", `${artifactHash}.json`);
  const record: CacheRecord = {
    cacheKey,
    irHeader,
  };
  await writeFileAtomic(irPath, JSON.stringify({ ...irHeader }, null, 2));
  await writeFileAtomic(recordPath, JSON.stringify(record, null, 2));

  return {
    ok: true,
    cacheHit: false,
    contentHash: fileHash,
    prefix,
    irHeader,
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
    return JSON.parse(raw) as CacheRecord;
  } catch {
    return null;
  }
}

async function hasCachedArtifacts(
  irHeader: WorkerResponse["irHeader"],
): Promise<boolean> {
  const requiredPaths = [
    ...Object.values(irHeader.codeByEnv),
    ...Object.values(irHeader.mapByEnv),
  ];

  if (requiredPaths.length === 0) {
    return false;
  }

  for (const filePath of requiredPaths) {
    try {
      await fs.access(filePath);
    } catch {
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
