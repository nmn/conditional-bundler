import type { Diagnostic } from "./diagnostics.js";
import type {
  ImportEntry,
  ExportLocal,
  ExportStar,
  ReexportNamed,
  DynamicImport,
  ConditionalImport,
  FileRecord,
} from "./ir.js";

export type TransformResolvedImport = {
  id: string | null;
  filePath: string | null;
  external: boolean;
  virtual?: boolean;
  meta?: Record<string, unknown>;
};

export type TransformInput = {
  id?: string;
  code: string;
  realPath: string;
  pkg: { name: string; version: string; root: string };
  syntax: { jsx: boolean; ts: boolean };
  envs: string[];
  envId?: string;
  resolvedImports?: Record<string, TransformResolvedImport>;
};

export type TransformMeta = {
  imports: ImportEntry[];
  exportsLocal: ExportLocal[];
  exportStars: ExportStar[];
  reexportsNamed: ReexportNamed[];
  dynamicImports: DynamicImport[];
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
  fileRecord?: FileRecord;
  codeByEnv?: Record<string, string>;
  diagnostics?: Diagnostic[];
  skipCore?: boolean;
};

export type TransformMultiResult = Record<string, TransformResult>;
