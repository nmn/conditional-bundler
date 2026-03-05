import type { ModuleNode, Provider } from "@bundler/shared";

export function resolveExportTables(
  nodes: ModuleNode[],
  nodeMap: Map<string, ModuleNode> = new Map(),
): void {
  if (nodeMap.size === 0) {
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
  }
  const remaining = new Set(nodes.map((node) => node.id));

  while (remaining.size > 0) {
    const progress = Array.from(remaining).filter((id) => {
      const node = nodeMap.get(id);
      if (!node) {
        return false;
      }
      return (
        node.irHeader.exportStars.every((star) => {
          const sourceId = node.resolvedSources.get(star.source);
          return !sourceId || !remaining.has(sourceId);
        }) &&
        node.irHeader.reexportsNamed.every((reexport) => {
          const sourceId = node.resolvedSources.get(reexport.source);
          return !sourceId || !remaining.has(sourceId);
        })
      );
    });

    for (const id of progress) {
      const node = nodeMap.get(id);
      if (!node) {
        remaining.delete(id);
        continue;
      }
      const table = new Map<string, Provider>();
      const ambiguous = new Set<string>();

      for (const localExport of node.irHeader.exportsLocal) {
        const localName =
          localExport.local === "default" ? "default" : localExport.local;
        table.set(localExport.exported, {
          moduleId: node.id,
          symbol: `${node.prefix}_${localName}`,
        });
      }

      for (const star of node.irHeader.exportStars) {
        const sourceId = node.resolvedSources.get(star.source);
        if (!sourceId) {
          continue;
        }
        const sourceNode = nodeMap.get(sourceId);
        if (!sourceNode?.exportTable) {
          continue;
        }
        for (const [name, provider] of sourceNode.exportTable.entries()) {
          if (name === "default") {
            continue;
          }
          if (!table.has(name)) {
            table.set(name, provider);
          } else if (table.get(name)?.symbol !== provider.symbol) {
            table.delete(name);
            ambiguous.add(name);
          }
        }
      }

      for (const reexport of node.irHeader.reexportsNamed) {
        const sourceId = node.resolvedSources.get(reexport.source);
        if (!sourceId) {
          continue;
        }
        const sourceNode = nodeMap.get(sourceId);
        if (!sourceNode?.exportTable) {
          continue;
        }
        if (table.has(reexport.exported)) {
          continue;
        }
        if (reexport.isNamespace) {
          table.set(reexport.exported, {
            moduleId: sourceId,
            symbol: `__NS__${sourceNode.prefix}`,
          });
          continue;
        }
        const provider = sourceNode.exportTable.get(reexport.imported);
        if (provider) {
          table.set(reexport.exported, provider);
        }
      }

      node.exportTable = table;
      node.ambiguous = ambiguous;
      remaining.delete(id);
    }
  }
}
