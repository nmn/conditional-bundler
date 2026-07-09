import type { BundlerPlugin } from "./plugins/types.js";
import type { CacheConfig } from "@bundler/shared";

export type EnvConfig = {
  conditions: string[];
  target: "node" | "browser";
};

export type EntrySpec = {
  id: string;
  path: string;
  envs?: string[];
};

export type OutputSpec = {
  outDir: string;
  fileName?: string;
  manifestFile?: string;
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
  css?: boolean;
  configFile?: string;
  configIdentity?: unknown;
  maxWorkers: number;
  diagnostics: "human" | "json";
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
  },
  plugins: [],
  cacheDir: "tmp/.bundler-cache",
  cache: undefined,
  css: true,
  maxWorkers: 4,
  diagnostics: "human",
};
