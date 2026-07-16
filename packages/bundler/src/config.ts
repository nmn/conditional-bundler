import type { BundlerPlugin } from "./plugins/types.js";
import type { CacheConfig } from "@bundler/shared";

export type EnvConfig = {
  conditions: string[];
  target: "node" | "browser";
};

export type JsLikeSyntaxConfig = {
  jsx?: boolean;
  typescript?: boolean;
};

export type TransformConfig = {
  css?: "lightningcss" | false;
  jsLike?: Record<string, JsLikeSyntaxConfig>;
};

export type EntrySpec = {
  id: string;
  path: string;
  envs?: string[];
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
  reactRefresh?: boolean | { envs?: string[] };
  fullReloadOnFailure?: boolean;
  port?: number;
  host?: string;
};

export type BundlerConfig = {
  envs: Record<string, EnvConfig>;
  entries: EntrySpec[];
  outputs: OutputSpec;
  plugins?: BundlerPlugin[];
  cacheDir?: string;
  cache?: CacheConfig;
  transforms?: TransformConfig;
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

export const defaultConfig: BundlerConfig = {
  envs: {
    default: {
      conditions: ["default"],
      target: "browser",
    },
  },
  entries: [],
  outputs: {
    outDir: "dist",
    fileName: "bundle.[env].[hash].js",
    htmlFileName: "[entry].html",
    cssFileName: "[entry].[env].[hash].css",
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
  css: true,
  maxWorkers: 4,
  diagnostics: "human",
  debug: false,
};
