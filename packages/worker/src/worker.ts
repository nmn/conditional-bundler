import { parentPort } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";
import { filePrefix, contentHash } from "@bundler/shared";
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
  codeByEnv?: Record<string, string>;
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
    pkg: TransformInput["pkg"];
    imports: NonNullable<TransformResult["meta"]>["imports"];
    reexportsNamed: NonNullable<TransformResult["meta"]>["reexportsNamed"];
    exportStars: NonNullable<TransformResult["meta"]>["exportStars"];
    exportsLocal: NonNullable<TransformResult["meta"]>["exportsLocal"];
    flags: NonNullable<TransformResult["meta"]>["flags"];
    dynamicImports: NonNullable<TransformResult["meta"]>["dynamicImports"];
    conditionalImports: NonNullable<TransformResult["meta"]>["conditionalImports"];
    discoveredEntrypoints: NonNullable<TransformResult["meta"]>["discoveredEntrypoints"];
    importRanges: NonNullable<TransformResult["meta"]>["importRanges"];
    exportRanges: NonNullable<TransformResult["meta"]>["exportRanges"];
  };
};

async function handleTransform(request: WorkerRequest): Promise<WorkerResponse> {
  const fileHash = contentHash(request.code);
  const parsedByEnv = request.codeByEnv;
  const relPath = path.posix.relative(request.pkg.root, request.realPath);
  const prefix = filePrefix(request.pkg.name, relPath);

  const result = await transformFile(request, prefix, parsedByEnv);
  const resultsByEnv = ("code" in result ? { default: result } : result) as TransformMultiResult;

  const codeByEnv: Record<string, string> = {};
  const mapByEnv: Record<string, string> = {};

  for (const [envId, envResult] of Object.entries(resultsByEnv)) {
    const result = envResult as TransformResult;
    const codePath = path.join(request.cacheDir, "code", `${fileHash}.${envId}.js`);
    const mapPath = result.map
      ? path.join(request.cacheDir, "map", `${fileHash}.${envId}.map`)
      : undefined;
    await writeFileAtomic(codePath, result.code);
    if (mapPath && result.map) {
      await writeFileAtomic(mapPath, result.map);
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
    exportRanges: first.meta.exportRanges
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
  prefix: string,
  overrideByEnv?: Record<string, string>
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
          envs: request.envs
        },
        {
          prefix,
          importAttrAllow: ["json"]
        }
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
      envs: request.envs
    },
    {
      prefix,
      importAttrAllow: ["json"]
    }
  );
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
