import type { ModuleNode, Provider } from "@bundler/shared";

export function resolveExportTables(nodes: ModuleNode[]): void {
  for (const node of nodes) {
    const table = new Map<string, Provider>();
    const ambiguous = new Set<string>();
    for (const localExport of node.irHeader.exportsLocal) {
      table.set(localExport.exported, {
        moduleId: node.id,
        symbol: `${node.prefix}_${localExport.exported}`
      });
    }
    node.exportTable = table;
    node.ambiguous = ambiguous;
  }
}
