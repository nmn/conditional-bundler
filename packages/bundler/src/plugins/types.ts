import type {
  Diagnostic,
  ConditionExpr,
  FileRecord,
  LinkReference,
  ResourceTemplate,
} from "@bundler/shared";
import type { BundleManifest } from "../manifest.js";
import type { OutputSpec } from "../config.js";

export type EnvValue<T> = T | ({ default?: T } & Record<string, T | undefined>);

export type ResolveImportKind =
  | "import"
  | "dynamic-import"
  | "reexport"
  | "conditional-import"
  | "conditional-else"
  | "css-import"
  | "css-url";

export type ModuleType = "javascript" | "css" | "asset";
export type ImportIntent = "module" | "url" | "raw" | "base64" | "assetPath";

export type ResolveImportResult =
  | { preserve: true }
  | {
      id: string;
      moduleIdentity?: string;
      filePath: string;
      type?: ModuleType;
      intent?: ImportIntent;
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
  intent: ImportIntent;
  importAttributes?: Record<string, string>;
  importerMeta?: Record<string, unknown>;
  resolveDefault: () => Promise<ResolveImportResult>;
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
  contents: string | Uint8Array;
  envId?: string;
  hash?: boolean;
  type?: "asset" | "document" | "manifest" | "style" | "source-map";
  contentType?: string;
  bundleKey?: string;
  /** Expose a generated stylesheet as one build-wide document/HMR resource. */
  global?: boolean;
};

export type EmitFile = (file: EmitFileInput) => void;

export type BuildStartContext = {
  addEntry: (entry: {
    id: string;
    path: string;
    envs?: string[];
    kind?: "auto" | "script" | "html" | "style";
    outputFileName?: string;
  }) => void;
  emitFile: EmitFile;
};

export type DynamicImportDraft = {
  hashKey: string;
  resolvedId: string | null;
  externalRequest?: string;
  exports?: Array<{ exported: string; symbol: string }>;
};

export type StaticBundleImportDraft = {
  entryId: string;
  symbols: string[];
};

export type BundlePart = {
  code: string;
  map?: string;
  sourceContents?: Record<string, string>;
  references?: LinkReference[];
};

export type DocumentTransformContext = {
  id: string;
  filePath: string;
  envId: string;
  target: "node" | "browser";
  source: string;
};

export type DocumentScript = {
  id: string;
  request?: string;
  code?: string;
  map?: string;
  moduleIdentity?: string;
  module: boolean;
};

export type DocumentStyle = {
  id: string;
  request?: string;
  code?: string;
  moduleIdentity?: string;
};

export type DocumentTransformResult = {
  template: ResourceTemplate;
  scripts: DocumentScript[];
  styles: DocumentStyle[];
  references: LinkReference[];
  outputFileName?: string;
  metadata?: Record<string, unknown>;
};

export type BundlePlanDraft = {
  envId: string;
  entryId: string;
  exportMode: "entry" | "dynamic";
  modules: string[];
  conditions: Array<{ moduleId: string; condition: ConditionExpr }>;
  conditionNames: string[];
  orderedParts: BundlePart[];
  staticImports?: StaticBundleImportDraft[];
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
  modules: FileRecord[];
  outputs: OutputSpec;
  resolveReference: (referenceId: string, fromFileName: string) => string;
  emitFile: EmitFile;
};

export type GenerateBundleResourcesContext = {
  bundles: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    modules: string[];
  }>;
  modules: FileRecord[];
  outputs: OutputSpec;
  resolveReference: (referenceId: string, fromFileName: string) => string;
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
export type GenerateBundleResourcesHook = (
  context: GenerateBundleResourcesContext,
) => Promise<void> | void;

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
  transformDocument?: EnvValue<
    (
      context: DocumentTransformContext,
    ) =>
      | Promise<DocumentTransformResult | undefined>
      | DocumentTransformResult
      | undefined
  >;
  beforeCombine?: EnvValue<BeforeCombineHook[]>;
  afterCombine?: EnvValue<AfterCombineHook[]>;
  buildEnd?: BuildEndHook;
  generateBundleResources?: GenerateBundleResourcesHook;
  transform?: EnvValue<BabelPluginSpec[]>;
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
  resourceFingerprint?: string;
  buildStart?: BuildStartHook;
  resolveImport?: InlineBundlerPlugin["resolveImport"];
  transformDocument?: InlineBundlerPlugin["transformDocument"];
  beforeCombine?: InlineBundlerPlugin["beforeCombine"];
  afterCombine?: InlineBundlerPlugin["afterCombine"];
  buildEnd?: BuildEndHook;
  generateBundleResources?: GenerateBundleResourcesHook;
  transform?: EnvValue<NormalizedBabelPluginSpec[]>;
  transformPre?: EnvValue<NormalizedBabelPluginSpec[]>;
  transformPost?: EnvValue<NormalizedBabelPluginSpec[]>;
};

export type WorkerTransformProfile = {
  fingerprint: string;
  transform: Record<string, NormalizedBabelPluginSpec[]>;
  transformPre: Record<string, NormalizedBabelPluginSpec[]>;
  transformPost: Record<string, NormalizedBabelPluginSpec[]>;
};

export type ModuleResolution = {
  id: string;
  moduleIdentity: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  target:
    | { kind: "file"; moduleId: string; canonicalPath: string }
    | { kind: "runtime"; specifier: string };
  type: ModuleType;
  intent: ImportIntent;
  meta?: Record<string, unknown>;
};

export type WorkerTransformResult = {
  fileRecordsByEnv: Record<string, FileRecord>;
};
