import fs from "node:fs";
import path from "node:path";
import {
  applyConditionIdToUrl,
  createOptionSet,
  parseConditionIdUrl,
  resolveUserAgentOptionKey,
  transformConditionalBundleById,
  type ConditionalBundleCache,
  type OptionSet,
  type ResolvedOptions,
} from "./index.js";

type ManifestAsset = {
  fileName: string;
  type: string;
  contentType?: string;
  bundleKey?: string;
};

type ManifestBundle = {
  id: string;
  fileName: string;
  platform?: "node" | "browser";
  targetIds?: string[];
};

export type ConditionalBuildManifest = {
  assets?: ManifestAsset[];
  bundles?: ManifestBundle[];
  metadata?: {
    conditions?: {
      global?: string[];
    };
  };
};

export type ConditionalAssetResponse =
  | { handled: false }
  | {
      handled: true;
      statusCode: number;
      contentType: string;
      body: string | Buffer;
    };

export function readBuildOptionSet(
  manifest: ConditionalBuildManifest,
): OptionSet {
  const configured = manifest.metadata?.conditions?.global;
  if (configured) {
    if (configured.some((name) => typeof name !== "string")) {
      throw new Error("Build condition metadata must contain only strings.");
    }
    return createOptionSet({ conditions: configured });
  }
  return createOptionSet({
    conditions: (manifest.assets ?? []).flatMap((asset) => {
      const conditionNames = (
        asset as ManifestAsset & { conditionNames?: unknown }
      ).conditionNames;
      return Array.isArray(conditionNames)
        ? conditionNames.filter(
            (condition): condition is string => typeof condition === "string",
          )
        : [];
    }),
  });
}

export async function resolveRequestOptions(
  manifest: ConditionalBuildManifest,
  userAgent: string | undefined,
): Promise<{ optionSet: OptionSet; resolved: ResolvedOptions }> {
  const optionSet = readBuildOptionSet(manifest);
  return {
    optionSet,
    resolved: await resolveUserAgentOptionKey(optionSet, userAgent),
  };
}

export async function readConditionalAssetRequest({
  dist,
  manifest,
  pathname,
  cache,
}: {
  dist: string;
  manifest: ConditionalBuildManifest;
  pathname: string;
  cache?: ConditionalBundleCache;
}): Promise<ConditionalAssetResponse> {
  const requested = safeRequestedFileName(pathname);
  if (!requested) {
    return looksLikeScriptRequest(pathname)
      ? notFoundResponse()
      : { handled: false };
  }
  const candidates = requested.startsWith("assets/")
    ? [requested, requested.slice("assets/".length)]
    : [requested];
  const optionSet = readBuildOptionSet(manifest);

  if (candidates.some(looksLikeVariantScriptRequest)) {
    for (const candidate of candidates) {
      let parsed;
      try {
        parsed = parseConditionIdUrl(candidate, optionSet);
      } catch {
        return notFoundResponse();
      }
      if (!parsed) continue;
      const asset = findBrowserScript(manifest, parsed.url);
      if (!asset) {
        return notFoundResponse();
      }
      const cacheScope = `${asset.fileName}:${parsed.optionKey}`;
      const scopedCache = cache
        ? {
            get: () => cache.get(cacheScope),
            set: (_key: string, value: string) =>
              cache.set?.(cacheScope, value),
          }
        : undefined;
      const source = fs.readFileSync(
        safeOutputPath(dist, asset.fileName),
        "utf8",
      );
      const transformed = await transformConditionalBundleById(
        source,
        optionSet,
        parsed.optionKey,
        { cache: scopedCache },
      );
      return {
        handled: true,
        statusCode: 200,
        contentType: asset.contentType ?? "text/javascript; charset=utf-8",
        body: applyConditionIdToUrl(
          transformed.code,
          optionSet,
          parsed.optionKey,
        ),
      };
    }
    return notFoundResponse();
  }

  const asset = (manifest.assets ?? []).find((candidate) =>
    candidates.includes(candidate.fileName),
  );
  if (!asset) {
    return looksLikeScriptRequest(requested)
      ? notFoundResponse()
      : { handled: false };
  }
  if (asset.type === "script") {
    if (
      optionSet.conditions.length === 0 &&
      findBrowserScript(manifest, asset.fileName)
    ) {
      return {
        handled: true,
        statusCode: 200,
        contentType: asset.contentType ?? "text/javascript; charset=utf-8",
        body: fs.readFileSync(safeOutputPath(dist, asset.fileName)),
      };
    }
    return notFoundResponse();
  }
  return {
    handled: true,
    statusCode: 200,
    contentType: asset.contentType ?? "application/octet-stream",
    body: fs.readFileSync(safeOutputPath(dist, asset.fileName)),
  };
}

function findBrowserScript(
  manifest: ConditionalBuildManifest,
  fileName: string,
): ManifestAsset | undefined {
  const asset = (manifest.assets ?? []).find(
    (candidate) =>
      candidate.type === "script" && candidate.fileName === fileName,
  );
  if (!asset) return undefined;
  const bundle = (manifest.bundles ?? []).find(
    (candidate) =>
      candidate.fileName === asset.fileName || candidate.id === asset.bundleKey,
  );
  return bundle?.platform === "browser" ? asset : undefined;
}

function safeRequestedFileName(pathname: string): string | null {
  let requested: string;
  try {
    requested = decodeURIComponent(pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
  if (
    !requested ||
    requested.includes("\\") ||
    requested.split("/").includes("..")
  ) {
    return null;
  }
  return requested;
}

function safeOutputPath(dist: string, fileName: string): string {
  const root = path.resolve(dist);
  const candidate = path.resolve(root, fileName);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to serve output outside '${root}'.`);
  }
  return candidate;
}

function looksLikeVariantScriptRequest(fileName: string): boolean {
  return /\.id-[^.]+\.[cm]?js$/i.test(fileName);
}

function looksLikeScriptRequest(fileName: string): boolean {
  return /\.[cm]?js$/i.test(fileName);
}

function notFoundResponse(): ConditionalAssetResponse {
  return {
    handled: true,
    statusCode: 404,
    contentType: "text/plain; charset=utf-8",
    body: "Not found",
  };
}
