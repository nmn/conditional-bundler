import type { Diagnostic } from "./diagnostics.js";
import type {
  ImportEntry,
  ExportLocal,
  ExportStar,
  ReexportNamed,
  ConditionalImport,
} from "./ir.js";
export type TransformInput = {
  code: string;
  realPath: string;
  pkg: {
    name: string;
    version: string;
    root: string;
  };
  syntax: {
    jsx: boolean;
    ts: boolean;
  };
  envs: string[];
};
export type TransformMeta = {
  imports: ImportEntry[];
  exportsLocal: ExportLocal[];
  exportStars: ExportStar[];
  reexportsNamed: ReexportNamed[];
  conditionalImports: ConditionalImport[];
  discoveredEntrypoints: string[];
  importRanges: Array<[number, number]>;
  exportRanges: Array<[number, number]>;
  flags: {
    hasTopLevelAwait: boolean;
    sideEffects: boolean;
    needsNamespaceObject: boolean;
  };
};
export type TransformPlugin = {
  name: string;
  transformModule: (
    input: TransformInput,
  ) => Promise<TransformResult | TransformMultiResult>;
};
export type TransformResult = {
  code: string;
  map?: string;
  meta?: TransformMeta;
  codeByEnv?: Record<string, string>;
  diagnostics?: Diagnostic[];
  skipCore?: boolean;
};
export type TransformMultiResult = Record<string, TransformResult>;
//# sourceMappingURL=transform-types.d.ts.map
