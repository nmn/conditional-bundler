import type {
  Diagnostic,
  ConditionExpr,
  FileRecord,
  LinkReference,
  ResourceTemplate,
} from "@bundler/shared";
import type { BundleManifest } from "../manifest.js";
import type { BundleEntryKind, OutputSpec, Platform } from "../config.js";

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

export type ResolveImportResult =
  | { preserve: true }
  | {
      id: string;
      moduleIdentity?: string;
      filePath: string;
      type?: ModuleType;
      representation?: string;
      meta?: Record<string, unknown>;
    };

export type ResolveImportContext = {
  fromId: string;
  fromFilePath: string;
  request: string;
  environmentId: string;
  targetId: string;
  platform: Platform;
  kind: ResolveImportKind;
  representation?: string;
  importAttributes?: Record<string, string>;
  importerMeta?: Record<string, unknown>;
  resolveDefault: () => Promise<ResolveImportResult>;
};

export type BabelPluginSpec = string | [string, Record<string, unknown>];
export type RepresentationWorkerTransformSpec =
  | string
  | [string, Record<string, unknown>];

export type RepresentationWorkerTransformContext = {
  id: string;
  moduleIdentity: string;
  canonicalPath: string;
  representation: string;
  /** Representation transforms are semantic-environment scoped, not target scoped. */
  environmentId: string;
  source: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
  pkg: { name: string; version: string };
  buildMode: string;
  dev: { hmr: boolean };
};

export type RepresentationWorkerTransformResult = {
  code: string;
  map?: string;
  extraOutputs?: Record<string, import("@bundler/shared").ExtraTransformOutput>;
  discoveredEntrypoints?: import("@bundler/shared").DiscoveredEntrypoint[];
  linkReferences?: LinkReference[];
};

export type ScopedBabelPluginSpec =
  | BabelPluginSpec
  | {
      plugin: BabelPluginSpec;
      environments?: "each" | string[];
      targets?: "each" | string[];
    };

export type TransformStageContext = {
  id: string;
  filePath: string;
  environmentId?: string;
  targetId?: string;
  platform?: Platform;
  pkg: { name: string; version: string; root: string };
  syntax: { jsx: boolean; ts: boolean };
};

export type EmitFileInput = {
  /** Portable logical identity used by output-url references. */
  outputId?: string;
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
    path: string;
    environment?: string;
    targets?: string[];
    kind?: "auto" | "script" | "html" | "style";
    outputFileName?: string;
  }) => void;
  emitFile: EmitFile;
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
  environmentId: string;
  targetId: string;
  platform: Platform;
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
  entryKind?: BundleEntryKind;
  exportMode: "entry" | "dynamic";
  modules: string[];
  conditions: Array<{ moduleId: string; condition: ConditionExpr }>;
  conditionNames: string[];
  orderedParts: BundlePart[];
  staticImports?: StaticBundleImportDraft[];
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
  entryKind: BundleEntryKind;
  exportMode: "entry" | "dynamic";
  code: string;
  map?: string;
  /**
   * Structured link metadata for the combined code. Hooks that add, remove,
   * or rename placeholders can return a replacement reference list.
   */
  references: LinkReference[];
  emitFile: EmitFile;
};

export type BuildEndContext = {
  bundles: Array<{
    id: string;
    scopeIds: string[];
    environmentIds: string[];
    targetIds: string[];
    entrypoints: Array<{
      envId: string;
      environmentId: string;
      targetId: string;
      entryId: string;
      entryKind: BundleEntryKind;
      exportMode: "entry" | "dynamic";
    }>;
    environmentId?: string;
    targetId?: string;
    platform?: Platform;
    envId: string;
    entryId: string;
    fileName: string;
  }>;
  manifest: BundleManifest;
  diagnostics: Diagnostic[];
  modules: FileRecord[];
  outputs: OutputSpec;
  resolveReference: (
    referenceId: string,
    fromFileName: string,
    scopeId?: string,
  ) => string;
  emitFile: EmitFile;
};

export type GenerateBundleResourcesContext = {
  /**
   * Pre-hash physical bundle descriptions. Resource bytes emitted here are
   * part of the bundle fingerprint, so final filenames are available only to
   * the post-finalization buildEnd hook.
   */
  bundles: Array<{
    id: string;
    scopeIds: string[];
    environmentIds: string[];
    targetIds: string[];
    entrypoints: Array<{
      envId: string;
      environmentId: string;
      targetId: string;
      entryId: string;
      entryKind: BundleEntryKind;
      exportMode: "entry" | "dynamic";
    }>;
    environmentId?: string;
    targetId?: string;
    platform?: Platform;
    envId: string;
    entryId: string;
    modules: string[];
  }>;
  modules: FileRecord[];
  outputs: OutputSpec;
  resolveReference: (
    referenceId: string,
    fromFileName: string,
    scopeId?: string,
  ) => string;
  emitFile: EmitFile;
};

export type PlanBundleResourcesContext = Omit<
  GenerateBundleResourcesContext,
  "resolveReference" | "emitFile"
>;

export type BeforeCombineHook = (
  context: BeforeCombineContext,
) => Promise<BundlePlanDraft[] | void> | BundlePlanDraft[] | void;

export type AfterCombineHook = (
  context: AfterCombineContext,
) =>
  | Promise<
      | { code: string; map?: string; references?: LinkReference[] }
      | string
      | void
    >
  | { code: string; map?: string; references?: LinkReference[] }
  | string
  | void;

export type BuildStartHook = (
  context: BuildStartContext,
) => Promise<void> | void;

export type BuildEndHook = (context: BuildEndContext) => Promise<void> | void;
export type GenerateBundleResourcesHook = (
  context: GenerateBundleResourcesContext,
) => Promise<void> | void;
export type PlanBundleResourcesHook = (
  context: PlanBundleResourcesContext,
) => /**
   * Return a deterministic descriptor for every bundle. Use an explicit
   * sentinel such as "none" when the plugin emits no resource for a bundle;
   * omitted descriptors conservatively prevent cross-scope coalescing.
   */
  | Promise<Record<string, string | undefined> | void>
  | Record<string, string | undefined>
  | void;

export type RepresentationHandler = {
  /**
   * Inherit resolution and worker transformation behavior from another `as`
   * type. Representation inheritance is independent from environments.
   */
  extends?: string;
  /**
   * Coordinator-side resolution for one `as` value. The represented file is
   * still read and transformed only by its own worker task.
   */
  resolve?: (
    context: ResolveImportContext,
  ) =>
    | Promise<ResolveImportResult | undefined>
    | ResolveImportResult
    | undefined;
  /**
   * Serializable, module-backed transform for this handler only. The module
   * receives the represented file's own bytes and must return a JavaScript
   * facade without inspecting dependencies.
   */
  workerTransform?: RepresentationWorkerTransformSpec;
};

export type NormalizedRepresentationHandler = Omit<
  RepresentationHandler,
  "workerTransform"
> & {
  identity: string;
  owner: string;
  resolveAs?: string;
  workerTransform?: NormalizedBabelPluginSpec;
};

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
  planBundleResources?: PlanBundleResourcesHook;
  generateBundleResources?: GenerateBundleResourcesHook;
  representations?: Record<string, RepresentationHandler>;
  manualChunk?: ManualChunkHook;
  transform?: ScopedBabelPluginSpec[];
  transformPre?: ScopedBabelPluginSpec[];
  /** Runs after every author/plugin source transform and before core extraction. */
  transformFinalize?: ScopedBabelPluginSpec[];
  transformPost?: ScopedBabelPluginSpec[];
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

export type NormalizedScopedBabelPluginSpec = {
  plugin: NormalizedBabelPluginSpec;
  environments?: "each" | string[];
  targets?: "each" | string[];
};

export type ManualChunkModuleInfo = {
  id: string;
  moduleIdentity?: string;
  filePath: string;
  environmentIds: string[];
  entryConsumers: string[];
};

export type ManualChunkContext = {
  getModuleInfo: (id: string) => ManualChunkModuleInfo | undefined;
};

export type ManualChunkHook = (
  module: ManualChunkModuleInfo,
  context: ManualChunkContext,
) => string | undefined;

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
  planBundleResources?: PlanBundleResourcesHook;
  generateBundleResources?: GenerateBundleResourcesHook;
  representations?: Record<string, NormalizedRepresentationHandler>;
  manualChunk?: ManualChunkHook;
  transform?: NormalizedScopedBabelPluginSpec[];
  transformPre?: NormalizedScopedBabelPluginSpec[];
  transformFinalize?: NormalizedScopedBabelPluginSpec[];
  transformPost?: NormalizedScopedBabelPluginSpec[];
};

export type WorkerTransformProfile = {
  fingerprint: string;
  transform: NormalizedScopedBabelPluginSpec[];
  transformPre: NormalizedScopedBabelPluginSpec[];
  transformFinalize: NormalizedScopedBabelPluginSpec[];
  transformPost: NormalizedScopedBabelPluginSpec[];
  representationTransforms: Record<string, NormalizedBabelPluginSpec>;
};

export type ModuleResolution = {
  id: string;
  moduleIdentity: string;
  filePath: string;
  /** Concrete environment/target scope selected for this dependency. */
  scopeId?: string;
  pkg: { name: string; version: string; root: string };
  target:
    | { kind: "file"; moduleId: string; canonicalPath: string }
    | { kind: "runtime"; specifier: string };
  type: ModuleType;
  representation?: string;
  meta?: Record<string, unknown>;
};

export type WorkerTransformResult = {
  variants: import("@bundler/shared").ModuleVariantRecord[];
  fileRecordsByEnv: Record<string, FileRecord>;
};
