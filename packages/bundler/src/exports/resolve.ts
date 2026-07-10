import type { CellRecord, ModuleNode, Provider } from "@bundler/shared";
import { sourceLookupKey } from "../graph/source-key.js";

export function resolveExportTables(
  nodes: ModuleNode[],
  nodeMap: Map<string, ModuleNode> = new Map(),
  options: { hmr?: boolean } = {},
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
          const sourceId = node.resolvedSources.get(sourceLookupKey(star));
          return !sourceId || !remaining.has(sourceId);
        }) &&
        node.irHeader.reexportsNamed.every((reexport) => {
          const sourceId = node.resolvedSources.get(sourceLookupKey(reexport));
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
      const generatedCells: CellRecord[] = [];
      const localCellMap = new Map<string, string>();

      for (const cell of node.irHeader.cells) {
        for (const symbol of cell.provides) {
          localCellMap.set(symbol, cell.id);
        }
      }

      for (const localExport of node.irHeader.exportsLocal) {
        const localName =
          localExport.local === "default" ? "default" : localExport.local;
        const symbol = `${node.prefix}_${localName}`;
        table.set(localExport.exported, {
          moduleId: node.id,
          cellId: localCellMap.get(symbol) ?? symbol,
          symbol,
        });
      }

      for (const star of node.irHeader.exportStars) {
        const sourceId = node.resolvedSources.get(sourceLookupKey(star));
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
          if (ambiguous.has(name)) {
            continue;
          }
          if (table.has(name)) {
            table.delete(name);
            ambiguous.add(name);
            continue;
          }

          const aliasCell = createAliasCell(
            node,
            star.sourceOrder ?? 0,
            name,
            provider,
            options.hmr === true,
          );
          generatedCells.push(aliasCell);
          table.set(name, {
            moduleId: node.id,
            cellId: aliasCell.id,
            symbol: `${node.prefix}_${name}`,
          });
        }
      }

      for (const reexport of node.irHeader.reexportsNamed) {
        if (ambiguous.has(reexport.exported) || table.has(reexport.exported)) {
          continue;
        }

        const sourceId = node.resolvedSources.get(sourceLookupKey(reexport));
        if (!sourceId) {
          continue;
        }
        const sourceNode = nodeMap.get(sourceId);
        if (!sourceNode?.exportTable) {
          continue;
        }

        if (reexport.isNamespace) {
          const namespaceCell = createNamespaceCell(
            node,
            reexport,
            sourceNode,
            options.hmr === true,
          );
          generatedCells.push(namespaceCell);
          table.set(reexport.exported, {
            moduleId: node.id,
            cellId: namespaceCell.id,
            symbol: `${node.prefix}_${reexport.exported}`,
          });
          continue;
        }

        const provider = sourceNode.exportTable.get(reexport.imported);
        if (!provider) {
          continue;
        }

        const aliasCell = createAliasCell(
          node,
          reexport.sourceOrder ?? 0,
          reexport.exported,
          provider,
          options.hmr === true,
        );
        generatedCells.push(aliasCell);
        table.set(reexport.exported, {
          moduleId: node.id,
          cellId: aliasCell.id,
          symbol: `${node.prefix}_${reexport.exported}`,
        });
      }

      node.generatedCells = generatedCells;
      node.exportTable = table;
      node.ambiguous = ambiguous;
      remaining.delete(id);
    }
  }
}

function createAliasCell(
  node: ModuleNode,
  sourceOrder: number,
  exported: string,
  provider: Provider,
  hmr: boolean,
): CellRecord {
  const symbol = `${node.prefix}_${exported}`;
  return {
    id: `${node.id}#generated:alias:${sourceOrder}:${exported}`,
    fileId: node.id,
    sourceOrder: 10000 + sourceOrder,
    kind: "generated",
    code: `${hmr ? "" : "const "}${symbol} = ${provider.symbol};`,
    provides: [symbol],
    internalDeps: [],
    externalDeps: [],
    providerDeps: [provider],
    eager: false,
  };
}

function createNamespaceCell(
  node: ModuleNode,
  reexport: ModuleNode["irHeader"]["reexportsNamed"][number],
  sourceNode: ModuleNode,
  hmr: boolean,
): CellRecord {
  const symbol = `${node.prefix}_${reexport.exported}`;
  const lines = [`${hmr ? "" : "const "}${symbol} = Object.create(null);`];
  const providerDeps: Provider[] = [];

  for (const [name, provider] of sourceNode.exportTable?.entries() ?? []) {
    lines.push(
      `Object.defineProperty(${symbol}, ${JSON.stringify(name)}, { enumerable: true, get: () => ${provider.symbol} });`,
    );
    providerDeps.push(provider);
  }
  lines.push(`Object.freeze(${symbol});`);

  return {
    id: `${node.id}#generated:ns:${reexport.sourceOrder ?? 0}:${reexport.exported}`,
    fileId: node.id,
    sourceOrder: 10000 + (reexport.sourceOrder ?? 0),
    kind: "generated",
    code: lines.join("\n"),
    provides: [symbol],
    internalDeps: [],
    externalDeps: [],
    providerDeps,
    eager: false,
  };
}
