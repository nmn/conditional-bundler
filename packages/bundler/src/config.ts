import type { BundlerPlugin } from "./plugins/types.js";

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
};

export type BundlerConfig = {
  envs: Record<string, EnvConfig>;
  entries: EntrySpec[];
  outputs: OutputSpec;
  plugins?: BundlerPlugin[];
  cacheDir?: string;
  maxWorkers: number;
  diagnostics: "human" | "json";
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
  maxWorkers: 4,
  diagnostics: "human",
};
