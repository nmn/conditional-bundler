export type DiagnosticSeverity = "error" | "warning";
export type Diagnostic = {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  file?: string;
  line?: number;
  column?: number;
  importChain?: string[];
  envId?: string;
};
export declare function formatDiagnosticHuman(diagnostic: Diagnostic): string;
export declare function formatDiagnosticsJson(
  diagnostics: Diagnostic[],
): string;
//# sourceMappingURL=diagnostics.d.ts.map
