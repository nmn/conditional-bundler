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

export function formatDiagnosticHuman(diagnostic: Diagnostic): string {
  const location = diagnostic.file
    ? ` at ${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}:${diagnostic.column ?? 0}` : ""}`
    : "";
  const chain = diagnostic.importChain && diagnostic.importChain.length > 0
    ? `\nImported from: ${diagnostic.importChain.join(" -> ")}`
    : "";
  return `${diagnostic.code}: ${diagnostic.message}${location}${chain}`;
}

export function formatDiagnosticsJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}
