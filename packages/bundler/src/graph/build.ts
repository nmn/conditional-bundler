import type { ModuleNode, IRHeader } from "@bundler/shared";
import type { ConditionExpr } from "@bundler/shared";
import type { Resolver } from "../resolver.js";
import { combineOr } from "@bundler/shared";
import { sourceLookupKey } from "./source-key.js";

export type ModuleGraph = {
  envId: string;
  nodes: Map<string, ModuleNode>;
  moduleIdentities: Map<string, string>;
};

export type BuildGraphInput = {
  envId: string;
  headers: IRHeader[];
  resolver: Resolver;
};

export async function buildGraph(input: BuildGraphInput): Promise<ModuleGraph> {
  const nodes = new Map<string, ModuleNode>();
  const moduleIdentities = new Map<string, string>();
  for (const header of input.headers) {
    nodes.set(header.id, {
      id: header.id,
      filePath: header.filePath,
      virtual: header.virtual,
      prefix: header.prefix,
      deps: [],
      unconditionalDeps: new Set<string>(),
      conditionalDeps: new Map<string, ConditionExpr>(),
      resolvedSources: new Map<string, string>(),
      irHeader: header,
    });
    if (header.moduleIdentity) {
      moduleIdentities.set(header.moduleIdentity, header.id);
    }
  }

  for (const node of nodes.values()) {
    for (const importEntry of node.irHeader.imports) {
      if (importEntry.kind === "type" || importEntry.external) {
        continue;
      }
      const resolved = await input.resolver(
        node.irHeader.id,
        node.irHeader.filePath,
        importEntry.request ?? importEntry.source,
        input.envId,
        importEntry.condition ? "conditional-import" : "import",
        importEntry.attributes ??
          (typeof importEntry.condition === "string"
            ? { condition: importEntry.condition }
            : undefined),
      );
      node.deps.push(resolved.id);
      node.resolvedSources.set(sourceLookupKey(importEntry), resolved.id);
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
        if (elseSource && !conditionalImport?.elseExternal) {
          const elseResolved = await input.resolver(
            node.irHeader.id,
            node.irHeader.filePath,
            conditionalImport?.elseRequest ?? elseSource,
            input.envId,
            "conditional-else",
            typeof importEntry.condition === "string"
              ? { condition: importEntry.condition }
              : undefined,
          );
          node.deps.push(elseResolved.id);
          node.resolvedSources.set(
            conditionalImport.elseRequest ?? elseSource,
            elseResolved.id,
          );
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
      if (star.external) {
        continue;
      }
      const resolved = await input.resolver(
        node.irHeader.id,
        node.irHeader.filePath,
        star.request ?? star.source,
        input.envId,
        "reexport",
      );
      node.deps.push(resolved.id);
      node.unconditionalDeps.add(resolved.id);
      node.resolvedSources.set(sourceLookupKey(star), resolved.id);
    }
    for (const reexport of node.irHeader.reexportsNamed) {
      if (reexport.external) {
        continue;
      }
      const resolved = await input.resolver(
        node.irHeader.id,
        node.irHeader.filePath,
        reexport.request ?? reexport.source,
        input.envId,
        "reexport",
      );
      node.deps.push(resolved.id);
      node.unconditionalDeps.add(resolved.id);
      node.resolvedSources.set(sourceLookupKey(reexport), resolved.id);
    }
  }

  for (const node of nodes.values()) {
    const unique = Array.from(new Set(node.deps));
    node.deps = unique;
  }

  return { envId: input.envId, nodes, moduleIdentities };
}
