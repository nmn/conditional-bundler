import fsp from "node:fs/promises";
import path from "node:path";
import {
  createEnvironmentConditionEvaluator,
  transformConditionalBundle,
} from "@bundler/assets";
import type { BuildResult } from "../builder.js";
import type { BundlerConfig } from "../config.js";

const conditionMarker = "/////##CONDITION_START##";
const evaluateCondition = createEnvironmentConditionEvaluator(process.env);
const servedAssetCache = new Map<string, string>();

export async function readDevAsset(
  config: BundlerConfig,
  build: BuildResult,
  fileName: string,
): Promise<{ body: Buffer | string; contentType: string } | null> {
  const bundle = build.bundles.find((item) => item.fileName === fileName);
  const asset = build.manifest.assets?.find(
    (item) => item.fileName === fileName,
  );
  if (!bundle && !asset) {
    return null;
  }

  const body = await fsp.readFile(
    safeOutputPath(config.outputs.outDir, asset?.fileName ?? bundle!.fileName),
  );
  const isScript = asset?.type === "script" || (bundle != null && !asset);
  return {
    body: isScript
      ? await resolveConditionalCode(
          body.toString("utf8"),
          fileName,
          asset?.conditionNames,
        )
      : body,
    contentType: asset?.contentType ?? "text/javascript; charset=utf-8",
  };
}

function safeOutputPath(outDir: string, fileName: string): string {
  const root = path.resolve(outDir);
  const candidate = path.resolve(root, fileName);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to serve output outside '${root}'.`);
  }
  return candidate;
}

export async function resolveConditionalPatch<T extends { records: string[] }>(
  patch: T,
): Promise<T> {
  return {
    ...patch,
    records: await Promise.all(
      patch.records.map((record) => resolveConditionalCode(record)),
    ),
  };
}

export async function resolveConditionalCode(
  code: string,
  cacheScope?: string,
  conditionNames?: string[],
): Promise<string> {
  if (!code.includes(conditionMarker)) {
    return code;
  }
  const transformed = await transformConditionalBundle(
    code,
    evaluateCondition,
    {
      optionSet: conditionNames ? { conditions: conditionNames } : undefined,
      cache: cacheScope
        ? {
            get(key) {
              return servedAssetCache.get(`${cacheScope}:${key}`);
            },
            set(key, value) {
              servedAssetCache.set(`${cacheScope}:${key}`, value);
            },
          }
        : undefined,
    },
  );
  return transformed.code;
}
