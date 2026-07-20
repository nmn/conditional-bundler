import {
  createEnvironmentConditionEvaluator,
  transformConditionalBundle,
} from "@bundler/assets";
import { readConditionalAssetRequest } from "@bundler/assets/server";
import type { BuildResult } from "../builder.js";
import type { BundlerConfig } from "../config.js";

const conditionMarker = "/////##CONDITION_START##";
const evaluateCondition = createEnvironmentConditionEvaluator(process.env);
const servedAssetCache = new Map<string, string>();

export async function readDevAsset(
  config: BundlerConfig,
  build: BuildResult,
  fileName: string,
): Promise<{
  body: Buffer | string;
  contentType: string;
  statusCode: number;
} | null> {
  const served = await readConditionalAssetRequest({
    dist: config.outputs.outDir,
    manifest: build.manifest,
    pathname: fileName,
    cache: {
      get: (key) => servedAssetCache.get(key),
      set: (key, value) => {
        servedAssetCache.set(key, value);
      },
    },
  });
  return served.handled
    ? {
        body: served.body,
        contentType: served.contentType,
        statusCode: served.statusCode,
      }
    : null;
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
