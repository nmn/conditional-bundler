import type { BundlerPlugin } from "./plugins/types.js";
import type { CacheConfig } from "@bundler/shared";

export type Platform = "node" | "browser";

export type PackageResolverReference = {
  __bundlerPackageResolverRef: true;
  module: string;
  options?: Record<string, unknown>;
};

export function resolver(
  module: string,
  options?: Record<string, unknown>,
): PackageResolverReference {
  return {
    __bundlerPackageResolverRef: true,
    module,
    options,
  };
}

export type TargetConfig = {
  platform: Platform;
  packageResolver?: PackageResolverReference;
  defines?: Record<string, string | number | boolean | null>;
};

/**
 * Environments are deliberately flat, opaque semantic names. Plugins match
 * them exactly; there is no inheritance or relationship to import `as` types.
 */
export type EnvironmentConfig = Record<string, never>;

/** @internal One concrete environment/target build scope. */
export type BuildScopeConfig = {
  environmentId: string;
  targetId: string;
  platform: Platform;
  packageResolver?: PackageResolverReference;
  defines: Record<string, string | number | boolean | null>;
  packageConditions: string[];
};

export type JsLikeSyntaxConfig = {
  jsx?: boolean;
  typescript?: boolean;
};

export type TransformConfig = {
  css?: "lightningcss" | false;
  jsLike?: Record<string, JsLikeSyntaxConfig>;
};

export type ImportNormalizationConfig = {
  /** Representation assigned to bare image imports. Defaults to sized references. */
  bareImages?: string | false;
  /** Representation assigned to other bare opaque-asset imports. Defaults to URL. */
  bareAssets?: string | false;
};

export type EntrySpec = {
  path: string;
  environment?: string;
  targets?: string[];
  kind?: "auto" | "script" | "html" | "style";
  outputFileName?: string;
  /** @internal Document-owned inline fragment source. */
  source?: string;
  /** @internal Source map for a document-owned inline fragment. */
  sourceMap?: string;
  /** @internal Portable identity for a document-owned inline fragment. */
  moduleIdentity?: string;
  /** @internal Real owner path used as the base for fragment imports. */
  resolveFrom?: string;
  /** @internal Already-transformed graph node selected for a discovered entry. */
  entryNodeId?: string;
  /** @internal Linking mode requested by a discovered entry. */
  exportMode?: "entry" | "dynamic";
};

/** @internal Coordinator form used after public configuration normalization. */
export type InternalEntrySpec = EntrySpec & {
  id: string;
  envs: string[];
};

export type SourceMapOutput =
  | false
  | "external"
  | "hidden"
  | {
      mode: "external" | "hidden";
      sourcesContent?: boolean;
    };

export type OutputSpec = {
  outDir: string;
  fileName?: string;
  manifestFile?: string;
  sourceMap?: SourceMapOutput;
  htmlFileName?: string;
  cssFileName?: string;
  assetFileName?: string;
  /** URL corresponding to the root of outDir. Defaults to "/". */
  rootURL?: string;
  /** @deprecated Use rootURL instead. */
  publicPath?: string;
};

export type DevSpec = {
  hmr?: boolean;
  reactRefresh?: boolean | { environments?: string[]; targets?: string[] };
  fullReloadOnFailure?: boolean;
  port?: number;
  host?: string;
};

export type BundlerConfig = {
  targets: Record<string, TargetConfig>;
  environments: Record<string, EnvironmentConfig>;
  entries: EntrySpec[];
  outputs: OutputSpec;
  plugins?: BundlerPlugin[];
  cacheDir?: string;
  cache?: CacheConfig;
  transforms?: TransformConfig;
  imports?: ImportNormalizationConfig;
  /** @deprecated Use transforms.css instead. */
  css?: boolean;
  configFile?: string;
  configIdentity?: unknown;
  maxWorkers: number;
  diagnostics: "human" | "json";
  /** Write a disposable, readable mirror of file transformations to .cache/__DEBUG__. */
  debug?: boolean;
  dev?: DevSpec;
};

/** @internal Existing linker terminology is isolated behind this normalized shape. */
export type InternalBundlerConfig = Omit<
  BundlerConfig,
  "targets" | "environments" | "entries"
> & {
  targets: Record<string, TargetConfig>;
  environments: Record<string, EnvironmentConfig>;
  entries: InternalEntrySpec[];
  envs: Record<string, BuildScopeConfig>;
};

export function buildScopeId(environmentId: string, targetId: string): string {
  return `${encodeURIComponent(targetId)}::${encodeURIComponent(environmentId)}`;
}

export function parseBuildScopeId(scopeId: string): {
  environmentId: string;
  targetId: string;
} {
  const separator = scopeId.indexOf("::");
  if (separator < 0) {
    throw new Error(`Malformed build scope '${scopeId}'.`);
  }
  return {
    targetId: decodeURIComponent(scopeId.slice(0, separator)),
    environmentId: decodeURIComponent(scopeId.slice(separator + 2)),
  };
}

export function normalizeBundlerConfig(
  config: BundlerConfig,
): InternalBundlerConfig {
  if ("envs" in (config as unknown as Record<string, unknown>)) {
    throw new Error(
      "The 'envs' configuration was removed. Define flat 'environments' and separate named 'targets'.",
    );
  }

  const environmentIds = Object.keys(config.environments);
  const targetIds = Object.keys(config.targets);
  if (environmentIds.length === 0) {
    throw new Error("At least one environment must be configured.");
  }
  if (targetIds.length === 0) {
    throw new Error("At least one target must be configured.");
  }

  for (const [environmentId, environment] of Object.entries(
    config.environments,
  )) {
    if (
      !environment ||
      typeof environment !== "object" ||
      Array.isArray(environment)
    ) {
      throw new Error(`Environment '${environmentId}' must be an object.`);
    }
    const keys = Object.keys(environment);
    if (keys.length > 0) {
      throw new Error(
        `Environment '${environmentId}' is flat and cannot declare '${keys[0]}'.`,
      );
    }
  }

  const envs: Record<string, BuildScopeConfig> = {};
  for (const [targetId, target] of Object.entries(config.targets)) {
    if (target.platform !== "node" && target.platform !== "browser") {
      throw new Error(
        `Target '${targetId}' has unsupported platform '${String(target.platform)}'.`,
      );
    }
    for (const environmentId of environmentIds) {
      envs[buildScopeId(environmentId, targetId)] = {
        environmentId,
        targetId,
        platform: target.platform,
        packageResolver: target.packageResolver,
        defines: { ...(target.defines ?? {}) },
        packageConditions:
          target.platform === "browser"
            ? ["browser", "import", "default"]
            : ["node", "import", "default"],
      };
    }
  }

  const entries = config.entries.map((entry) =>
    normalizeEntrySpec(entry, config),
  );

  return {
    ...config,
    entries,
    envs,
  };
}

export function normalizeEntrySpec(
  entry: EntrySpec,
  config: Pick<BundlerConfig, "environments" | "targets">,
): InternalEntrySpec {
  if ("id" in (entry as unknown as Record<string, unknown>)) {
    throw new Error(
      `Entry '${entry.path}' declares the removed 'id' field. Entry identity is derived from its path, environment, representation, and target.`,
    );
  }
  const environmentIds = Object.keys(config.environments);
  const targetIds = Object.keys(config.targets);
  const environmentId =
    entry.environment ??
    (environmentIds.length === 1 ? environmentIds[0] : undefined);
  if (!environmentId || !config.environments[environmentId]) {
    throw new Error(
      entry.environment
        ? `Unknown environment '${entry.environment}' for entry '${entry.path}'.`
        : `Entry '${entry.path}' must select an environment.`,
    );
  }
  const requestedTargets = entry.targets ?? targetIds;
  for (const targetId of requestedTargets) {
    if (!config.targets[targetId]) {
      throw new Error(
        `Unknown target '${targetId}' for entry '${entry.path}'.`,
      );
    }
  }
  return {
    ...entry,
    environment: environmentId,
    targets: [...requestedTargets],
    id: entry.path,
    envs: requestedTargets.map((targetId) =>
      buildScopeId(environmentId, targetId),
    ),
  };
}

export const defaultConfig: BundlerConfig = {
  targets: {
    default: {
      platform: "browser",
    },
  },
  environments: {
    default: {},
  },
  entries: [],
  outputs: {
    outDir: "dist",
    fileName: "bundle.[target].[environment].[hash].js",
    htmlFileName: "[entry].html",
    cssFileName: "[entry].[target].[environment].[hash].css",
    assetFileName: "assets/[name].[hash][ext]",
    sourceMap: false,
  },
  plugins: [],
  cacheDir: "tmp/.bundler-cache",
  cache: undefined,
  transforms: {
    css: "lightningcss",
    jsLike: {
      ".js": {},
      ".mjs": {},
      ".cjs": {},
      ".jsx": { jsx: true },
      ".ts": { typescript: true },
      ".tsx": { jsx: true, typescript: true },
    },
  },
  imports: {
    bareImages: "image-reference-with-size",
    bareAssets: "url",
  },
  css: true,
  maxWorkers: 4,
  diagnostics: "human",
  debug: false,
};
