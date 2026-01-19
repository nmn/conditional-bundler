import type { ConditionExpr } from "./conditions.js";

export type ImportSpecifier = {
  imported: string;
  local: string;
  useRanges: Array<[number, number]>;
};

export type ImportEntry = {
  source: string;
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
  imported: string;
  exported: string;
  isNamespace?: boolean;
};

export type ExportStar = {
  source: string;
};

export type DynamicImport = {
  source: string;
  hashKey: string;
  moduleId?: string;
};

export type ConditionalImport = {
  source: string;
  condition: ConditionExpr;
  elseSource?: string;
};

export type FileFlags = {
  hasTopLevelAwait: boolean;
  sideEffects: boolean;
  needsNamespaceObject: boolean;
};

export type FileIR = {
  id: string;
  realPath: string;
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
  discoveredEntrypoints: string[];
  importRanges: Array<[number, number]>;
  exportRanges: Array<[number, number]>;
  codeByEnv: Record<string, string>;
  mapByEnv: Record<string, string>;
  diagnostics: { errors: string[]; warnings: string[] };
};

export type IRHeader = Pick<
  FileIR,
  | "id"
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
  | "importRanges"
  | "exportRanges"
  | "pkg"
> & {
  envs: string[];
  codeByEnv: Record<string, string>;
  mapByEnv: Record<string, string>;
};

export type Provider = {
  moduleId: string;
  symbol: string;
};

export type ModuleNode = {
  id: string;
  prefix: string;
  deps: string[];
  conditionalDeps: Map<string, ConditionExpr>;
  resolvedSources: Map<string, string>;
  condition?: ConditionExpr;
  irHeader: IRHeader;
  exportTable?: Map<string, Provider>;
  ambiguous?: Set<string>;
};
