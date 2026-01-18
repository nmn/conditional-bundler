import { parentPort } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";
import { filePrefix, importConstKey, contentHash } from "@bundler/shared";
import type { TransformInput, TransformResult, TransformMultiResult } from "@bundler/shared";
import { writeFileAtomic, ensureDir } from "@bundler/shared";

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
};

type WorkerResponse = {
  ok: boolean;
  contentHash: string;
  prefix: string;
  irHeader: {
    id: string;
    prefix: string;
    contentHash: string;
    envs: string[];
    codeByEnv: Record<string, string>;
    mapByEnv: Record<string, string>;
    imports: TransformResult["meta"]["imports"];
    reexportsNamed: TransformResult["meta"]["reexportsNamed"];
    exportStars: TransformResult["meta"]["exportStars"];
    exportsLocal: TransformResult["meta"]["exportsLocal"];
    flags: TransformResult["meta"]["flags"];
    dynamicImports: TransformResult["meta"]["dynamicImports"];
    conditionalImports: TransformResult["meta"]["conditionalImports"];
    discoveredEntrypoints: TransformResult["meta"]["discoveredEntrypoints"];
  };
};

async function handleTransform(request: WorkerRequest): Promise<WorkerResponse> {
  const fileHash = contentHash(request.code);
  const relPath = path.posix.relative(request.pkg.root, request.realPath);
  const prefix = filePrefix(request.pkg.name, relPath);

  const result = await transformFile(request, prefix);
  const resultsByEnv: TransformMultiResult = "code" in result ? { default: result } : result;

  const codeByEnv: Record<string, string> = {};
  const mapByEnv: Record<string, string> = {};

  for (const [envId, envResult] of Object.entries(resultsByEnv)) {
    const codePath = path.join(request.cacheDir, "code", `${fileHash}.${envId}.js`);
    const mapPath = envResult.map
      ? path.join(request.cacheDir, "map", `${fileHash}.${envId}.map`)
      : undefined;
    await writeFileAtomic(codePath, envResult.code);
    if (mapPath && envResult.map) {
      await writeFileAtomic(mapPath, envResult.map);
      mapByEnv[envId] = mapPath;
    }
    codeByEnv[envId] = codePath;
  }

  const first = Object.values(resultsByEnv)[0];

  const irHeader = {
    id: request.realPath,
    prefix,
    contentHash: fileHash,
    envs: Object.keys(resultsByEnv),
    codeByEnv,
    mapByEnv,
    imports: first.meta.imports,
    reexportsNamed: first.meta.reexportsNamed,
    exportStars: first.meta.exportStars,
    exportsLocal: first.meta.exportsLocal,
    flags: first.meta.flags,
    dynamicImports: first.meta.dynamicImports,
    conditionalImports: first.meta.conditionalImports,
    discoveredEntrypoints: first.meta.discoveredEntrypoints
  };

  const irPath = path.join(request.cacheDir, "ir", `${fileHash}.json`);
  await writeFileAtomic(irPath, JSON.stringify({ ...irHeader }, null, 2));

  return {
    ok: true,
    contentHash: fileHash,
    prefix,
    irHeader
  };
}

async function transformFile(
  request: WorkerRequest,
  prefix: string
): Promise<TransformResult | TransformMultiResult> {
  const meta = {
    imports: [],
    exportsLocal: [],
    exportStars: [],
    reexportsNamed: [],
    dynamicImports: [],
    conditionalImports: [],
    discoveredEntrypoints: [],
    flags: {
      hasTopLevelAwait: false,
      sideEffects: true,
      needsNamespaceObject: false
    }
  };
  return {
    code: request.code,
    map: undefined,
    meta
  };
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
