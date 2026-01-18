import type { Diagnostic } from "./diagnostics.js";
import type { ConditionExpr } from "./conditions.js";
import type { ImportEntry, ExportLocal, ExportStar, ReexportNamed, DynamicImport, ConditionalImport } from "./ir.js";

export type TransformInput = {
  code: string;
  realPath: string;
  pkg: { name: string; version: string; root: string };
  syntax: { jsx: boolean; ts: boolean };
  envs: string[];
};

export type TransformMeta = {
  imports: ImportEntry[];
  exportsLocal: ExportLocal[];
  exportStars: ExportStar[];
  reexportsNamed: ReexportNamed[];
  dynamicImports: DynamicImport[];
  conditionalImports: ConditionalImport[];
  discoveredEntrypoints: string[];
  flags: {
    hasTopLevelAwait: boolean;
    sideEffects: boolean;
    needsNamespaceObject: boolean;
  };
};

export type TransformResult = {
  code: string;
  map?: string;
  meta: TransformMeta;
  diagnostics?: Diagnostic[];
};

export type TransformMultiResult = Record<string, TransformResult>;

export type ConditionMeta = {
  condition: ConditionExpr;
};
