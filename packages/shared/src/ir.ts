import type { ConditionExpr } from "./conditions.js";

export type ImportSpecifier = {
  imported: string;
  local: string;
  useRanges: Array<[number, number]>;
};

export type DependencyTarget =
  | { kind: "file"; moduleId: string; canonicalPath: string }
  | { kind: "runtime"; specifier: string };

export type ImportEntry = {
  source: string;
  request?: string;
  target: DependencyTarget;
  kind: "value" | "type" | "side-effect";
  isNamespace: boolean;
  isDefault: boolean;
  namespaceUsage?: "static" | "dynamic";
  condition?: ConditionExpr;
  attributes?: Record<string, string> | null;
  specifiers: ImportSpecifier[];
};

export type ExportLocal = {
  local: string;
  exported: string;
  kind: "var" | "func" | "class" | "default";
};

export type ReexportNamed = {
  source: string;
  request?: string;
  target: DependencyTarget;
  imported: string;
  exported: string;
  isNamespace?: boolean;
  sourceOrder?: number;
};

export type ExportStar = {
  source: string;
  request?: string;
  target: DependencyTarget;
  sourceOrder?: number;
};

export type DynamicImport = {
  source: string;
  request?: string;
  target: DependencyTarget;
  hashKey: string;
};

export type DiscoveredEntrypoint =
  | string
  | {
      id?: string;
      request: string;
      envs?: string[];
    };

export type ReferenceEncoding =
  | "javascript-expression"
  | "html-attribute"
  | "html-elements"
  | "html-srcset"
  | "css-url"
  | "url";

export type LinkReference =
  | {
      id: string;
      kind: "module-url" | "module-filename" | "module-dirname";
      symbol: string;
      ownerId: string;
    }
  | {
      id: string;
      kind: "asset-url";
      symbol: string;
      assetId: string;
      ownerId?: string;
      request?: string;
      usage?: "javascript" | "css-variable";
    }
  | {
      id: string;
      kind: "output-url";
      outputId: string;
      outputType: "script" | "style";
      ownerId?: string;
    }
  | {
      id: string;
      kind: "output-integrity";
      outputId: string;
      outputType: "script" | "style";
      ownerId?: string;
    }
  | {
      id: string;
      kind: "output-styles";
      outputIds: string[];
      ownerId?: string;
    };

export type TemplatePart =
  | { kind: "text"; value: string; map?: string }
  | {
      kind: "reference";
      referenceId: string;
      encoding: ReferenceEncoding;
    };

export type ResourceTemplate = {
  parts: TemplatePart[];
  references: LinkReference[];
};

export type ExtraTransformOutput = {
  /** Portable semantic type understood by link-time plugins. */
  type?: string;
  contents?: string | Uint8Array;
  artifactPath?: string;
  map?: string;
  mapArtifactPath?: string;
  template?: ResourceTemplate;
  metadata?: unknown;
};

export type CellExternalDep =
  | {
      kind: "import";
      source: string;
      request?: string;
      target?: DependencyTarget;
      imported: string;
    }
  | {
      kind: "side-effect";
      source: string;
      request?: string;
      target?: DependencyTarget;
    };

export type CellRecord = {
  id: string;
  fileId: string;
  sourceOrder: number;
  kind: "worker" | "conditional" | "generated";
  code?: string;
  map?: string;
  artifactPath?: string;
  mapArtifactPath?: string;
  linkReferences?: LinkReference[];
  provides: string[];
  internalDeps: string[];
  resourceDeps?: string[];
  externalDeps: CellExternalDep[];
  providerDeps?: Provider[];
  eager: boolean;
};

export type ConditionalImport = {
  source: string;
  request?: string;
  target: DependencyTarget;
  condition: ConditionExpr;
  elseSource?: string;
  elseRequest?: string;
  elseTarget?: DependencyTarget;
};

export type FileFlags = {
  hasTopLevelAwait: boolean;
  sideEffects: boolean;
  needsNamespaceObject: boolean;
};

export type FileIR = {
  id: string;
  moduleIdentity?: string;
  realPath: string;
  filePath: string;
  pkg: { name: string; version: string; root: string };
  prefix: string;
  contentHash: string;
  syntax: { jsx: boolean; ts: boolean };
  flags: FileFlags;
  imports: ImportEntry[];
  reexportsNamed: ReexportNamed[];
  exportStars: ExportStar[];
  exportsLocal: ExportLocal[];
  dynamicImports: DynamicImport[];
  conditionalImports: ConditionalImport[];
  discoveredEntrypoints: DiscoveredEntrypoint[];
  extraOutputs?: Record<string, ExtraTransformOutput>;
  linkReferences?: LinkReference[];
  resolutionMeta?: Record<string, unknown>;
  cells: CellRecord[];
  importRanges: Array<[number, number]>;
  exportRanges: Array<[number, number]>;
  codeByEnv: Record<string, string>;
  mapByEnv: Record<string, string>;
  diagnostics: { errors: string[]; warnings: string[] };
};

export type FileRecord = Pick<
  FileIR,
  | "id"
  | "moduleIdentity"
  | "filePath"
  | "prefix"
  | "contentHash"
  | "imports"
  | "reexportsNamed"
  | "exportStars"
  | "exportsLocal"
  | "flags"
  | "dynamicImports"
  | "conditionalImports"
  | "discoveredEntrypoints"
  | "extraOutputs"
  | "linkReferences"
  | "resolutionMeta"
  | "cells"
  | "importRanges"
  | "exportRanges"
  | "pkg"
> & {
  envs: string[];
  codeByEnv: Record<string, string>;
  mapByEnv: Record<string, string>;
  sourceContents?: Record<string, string>;
};

export type IRHeader = FileRecord;

export type Provider = {
  moduleId: string;
  cellId: string;
  symbol: string;
};

export type ModuleNode = {
  id: string;
  filePath: string;
  prefix: string;
  deps: string[];
  unconditionalDeps: Set<string>;
  conditionalDeps: Map<string, ConditionExpr>;
  resolvedSources: Map<string, string>;
  condition?: ConditionExpr;
  irHeader: FileRecord;
  generatedCells?: CellRecord[];
  exportTable?: Map<string, Provider>;
  ambiguous?: Set<string>;
};
