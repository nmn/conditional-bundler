import type { ModuleNode, IRHeader } from "@bundler/shared";
import type { ConditionExpr } from "@bundler/shared";
import type { Resolver } from "../resolver.js";
import { combineOr } from "@bundler/shared";

export type ModuleGraph = {
  envId: string;
  nodes: Map<string, ModuleNode>;
};

export type BuildGraphInput = {
  envId: string;
  headers: IRHeader[];
  resolver: Resolver;
};

export async function buildGraph(input: BuildGraphInput): Promise<ModuleGraph> {
  const nodes = new Map<string, ModuleNode>();
  for (const header of input.headers) {
    nodes.set(header.id, {
      id: header.id,
      prefix: header.prefix,
      deps: [],
      unconditionalDeps: new Set<string>(),
      conditionalDeps: new Map<string, ConditionExpr>(),
      resolvedSources: new Map<string, string>(),
      irHeader: header,
    });
  }

  for (const node of nodes.values()) {
    for (const importEntry of node.irHeader.imports) {
      if (importEntry.kind === "type") {
        continue;
      }
      const resolved = await input.resolver(
        node.irHeader.id,
        importEntry.request ?? importEntry.source,
        input.envId,
      );
      node.deps.push(resolved.id);
      node.resolvedSources.set(importEntry.source, resolved.id);
      if (importEntry.condition) {
        const existing = node.conditionalDeps.get(resolved.id);
        node.conditionalDeps.set(
          resolved.id,
          existing
            ? combineOr([existing, importEntry.condition])
            : importEntry.condition,
        );
        const conditionalImport = node.irHeader.conditionalImports.find(
          (item) => item.source === importEntry.source,
        );
        const elseSource = conditionalImport?.elseSource;
        if (elseSource) {
          const elseResolved = await input.resolver(
            node.irHeader.id,
            conditionalImport?.elseRequest ?? elseSource,
            input.envId,
          );
          node.deps.push(elseResolved.id);
          node.resolvedSources.set(elseSource, elseResolved.id);
          const elseCondition = { NOT: importEntry.condition };
          const existingElse = node.conditionalDeps.get(elseResolved.id);
          node.conditionalDeps.set(
            elseResolved.id,
            existingElse
              ? combineOr([existingElse, elseCondition])
              : elseCondition,
          );
        }
      } else {
        node.unconditionalDeps.add(resolved.id);
      }
    }
    for (const star of node.irHeader.exportStars) {
      const resolved = await input.resolver(
        node.irHeader.id,
        star.request ?? star.source,
        input.envId,
      );
      node.deps.push(resolved.id);
      node.unconditionalDeps.add(resolved.id);
      node.resolvedSources.set(star.source, resolved.id);
    }
    for (const reexport of node.irHeader.reexportsNamed) {
      const resolved = await input.resolver(
        node.irHeader.id,
        reexport.request ?? reexport.source,
        input.envId,
      );
      node.deps.push(resolved.id);
      node.unconditionalDeps.add(resolved.id);
      node.resolvedSources.set(reexport.source, resolved.id);
    }
  }

  for (const node of nodes.values()) {
    const unique = Array.from(new Set(node.deps));
    node.deps = unique;
  }

  return { envId: input.envId, nodes };
}
