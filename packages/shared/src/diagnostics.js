export function formatDiagnosticHuman(diagnostic) {
    const location = diagnostic.file
        ? ` at ${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}:${diagnostic.column ?? 0}` : ""}`
        : "";
    const chain = diagnostic.importChain && diagnostic.importChain.length > 0
        ? `\nImported from: ${diagnostic.importChain.join(" -> ")}`
        : "";
    return `${diagnostic.code}: ${diagnostic.message}${location}${chain}`;
}
export function formatDiagnosticsJson(diagnostics) {
    return JSON.stringify(diagnostics, null, 2);
}
//# sourceMappingURL=diagnostics.js.map