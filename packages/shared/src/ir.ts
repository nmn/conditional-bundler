import type { ConditionExpr } from "./conditions.js";

export type ImportSpecifier = {
  imported: string;
  local: string;
  useRanges: Array<[number, number]>;
};

export type ImportEntry = {
  source: string;
  request?: string;
  moduleId?: string | null;
  external?: boolean;
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
  moduleId?: string | null;
  external?: boolean;
  imported: string;
  exported: string;
  isNamespace?: boolean;
  sourceOrder?: number;
};

export type ExportStar = {
  source: string;
  request?: string;
  moduleId?: string | null;
  external?: boolean;
  sourceOrder?: number;
};

export type DynamicImport = {
  source: string;
  request?: string;
  moduleId?: string | null;
  external?: boolean;
  hashKey: string;
};

export type DiscoveredEntrypoint =
  | string
  | {
      id?: string;
      request: string;
      envs?: string[];
    };

export type ExtraTransformOutput = {
  contents: string;
  map?: string;
  metadata?: unknown;
};

export type CellExternalDep =
  | {
      kind: "import";
      source: string;
      request?: string;
      imported: string;
    }
  | {
      kind: "side-effect";
      source: string;
      request?: string;
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
  provides: string[];
  internalDeps: string[];
  externalDeps: CellExternalDep[];
  providerDeps?: Provider[];
  eager: boolean;
};

export type ConditionalImport = {
  source: string;
  request?: string;
  moduleId?: string | null;
  external?: boolean;
  condition: ConditionExpr;
  elseSource?: string;
  elseRequest?: string;
  elseModuleId?: string | null;
  elseExternal?: boolean;
};

export type FileFlags = {
  hasTopLevelAwait: boolean;
  sideEffects: boolean;
  needsNamespaceObject: boolean;
};

export type FileIR = {
  id: string;
  realPath: string;
  filePath: string;
  virtual?: boolean;
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
  | "filePath"
  | "virtual"
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
  virtual?: boolean;
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
