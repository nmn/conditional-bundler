import type { Diagnostic, FileRecord } from "@bundler/shared";
import type { BundleManifest } from "../manifest.js";

export type EnvValue<T> = T | ({ default?: T } & Record<string, T | undefined>);

export type ResolveImportKind =
  | "import"
  | "dynamic-import"
  | "reexport"
  | "conditional-import"
  | "conditional-else";

export type ResolveImportResult = null | {
  id: string;
  filePath: string;
  virtual?: boolean;
  meta?: Record<string, unknown>;
};

export type ResolveImportContext = {
  fromId: string;
  fromFilePath: string;
  request: string;
  envId: string;
  conditions: string[];
  target: "node" | "browser";
  kind: ResolveImportKind;
  importAttributes?: Record<string, string>;
  resolveDefault: () => Promise<ResolveImportResult>;
};

export type LoadContext = {
  id: string;
  filePath: string;
  envId: string;
  target: "node" | "browser";
  syntax: { jsx: boolean; ts: boolean };
};

export type LoadResult = {
  code: string;
  map?: string;
  codeByEnv?: Record<string, string>;
  mapByEnv?: Record<string, string>;
};

export type BabelPluginSpec = string | [string, Record<string, unknown>];

export type TransformStageContext = {
  id: string;
  filePath: string;
  envId: string;
  pkg: { name: string; version: string; root: string };
  syntax: { jsx: boolean; ts: boolean };
};

export type EmitFileInput = {
  fileName: string;
  contents: string;
  envId?: string;
  hash?: boolean;
  type?: "asset" | "manifest";
};

export type EmitFile = (file: EmitFileInput) => void;

export type BuildStartContext = {
  addEntry: (entry: { id: string; path: string; envs?: string[] }) => void;
  emitFile: EmitFile;
};

export type DynamicImportDraft = {
  hashKey: string;
  resolvedId: string | null;
  externalRequest?: string;
  exports?: Array<{ exported: string; symbol: string }>;
};

export type BundlePlanDraft = {
  envId: string;
  entryId: string;
  exportMode: "entry" | "dynamic";
  modules: string[];
  orderedParts: string[];
  dynamicImports: DynamicImportDraft[];
  diagnostics: Diagnostic[];
};

export type BeforeCombineContext = {
  envId: string;
  plans: BundlePlanDraft[];
  emitFile: EmitFile;
};

export type AfterCombineContext = {
  envId: string;
  entryId: string;
  exportMode: "entry" | "dynamic";
  code: string;
  map?: string;
  emitFile: EmitFile;
};

export type BuildEndContext = {
  bundles: Array<{ envId: string; entryId: string; fileName: string }>;
  manifest: BundleManifest;
  diagnostics: Diagnostic[];
  emitFile: EmitFile;
};

export type BeforeCombineHook = (
  context: BeforeCombineContext,
) => Promise<BundlePlanDraft[] | void> | BundlePlanDraft[] | void;

export type AfterCombineHook = (
  context: AfterCombineContext,
) =>
  | Promise<{ code: string; map?: string } | string | void>
  | { code: string; map?: string }
  | string
  | void;

export type BuildStartHook = (
  context: BuildStartContext,
) => Promise<void> | void;

export type BuildEndHook = (context: BuildEndContext) => Promise<void> | void;

export type InlineBundlerPlugin = {
  name: string;
  buildStart?: BuildStartHook;
  resolveImport?: EnvValue<
    (
      context: ResolveImportContext,
    ) =>
      | Promise<ResolveImportResult | undefined>
      | ResolveImportResult
      | undefined
  >;
  load?: EnvValue<
    (
      context: LoadContext,
    ) => Promise<LoadResult | undefined> | LoadResult | undefined
  >;
  beforeCombine?: EnvValue<BeforeCombineHook[]>;
  afterCombine?: EnvValue<AfterCombineHook[]>;
  buildEnd?: BuildEndHook;
  transformPre?: EnvValue<BabelPluginSpec[]>;
  transformPost?: EnvValue<BabelPluginSpec[]>;
};

export type ModuleBundlerPlugin = {
  __bundlerPluginRef: true;
  module: string;
  options?: Record<string, unknown>;
};

export type BundlerPlugin = InlineBundlerPlugin | ModuleBundlerPlugin;

export type NormalizedBabelPluginSpec = {
  modulePath: string;
  options?: Record<string, unknown>;
};

export type NormalizedPlugin = {
  name: string;
  modulePath?: string;
  workerFingerprint?: string;
  buildStart?: BuildStartHook;
  resolveImport?: InlineBundlerPlugin["resolveImport"];
  load?: InlineBundlerPlugin["load"];
  beforeCombine?: InlineBundlerPlugin["beforeCombine"];
  afterCombine?: InlineBundlerPlugin["afterCombine"];
  buildEnd?: BuildEndHook;
  transformPre?: EnvValue<NormalizedBabelPluginSpec[]>;
  transformPost?: EnvValue<NormalizedBabelPluginSpec[]>;
};

export type WorkerTransformProfile = {
  fingerprint: string;
  transformPre: Record<string, NormalizedBabelPluginSpec[]>;
  transformPost: Record<string, NormalizedBabelPluginSpec[]>;
};

export type ModuleResolution = {
  id: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  external: boolean;
  virtual?: boolean;
  meta?: Record<string, unknown>;
};

export type LoadModuleResult = {
  code: string;
  codeByEnv?: Record<string, string>;
  mapByEnv?: Record<string, string>;
};

export type LoadedModuleRecord = {
  id: string;
  filePath: string;
  virtual?: boolean;
  pkg: { name: string; version: string; root: string };
  syntax: { jsx: boolean; ts: boolean };
  code: string;
  codeByEnv?: Record<string, string>;
  mapByEnv?: Record<string, string>;
};

export type WorkerTransformResult = {
  fileRecordsByEnv: Record<string, FileRecord>;
};
