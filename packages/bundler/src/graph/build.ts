import type { ModuleNode, IRHeader } from "@bundler/shared";
import type { ConditionExpr } from "@bundler/shared";
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
};

export async function buildGraph(input: BuildGraphInput): Promise<ModuleGraph> {
  const nodes = new Map<string, ModuleNode>();
  const moduleIdentities = new Map<string, string>();
  for (const header of input.headers) {
    nodes.set(header.id, {
      id: header.id,
      filePath: header.filePath,
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
      if (
        importEntry.kind === "type" ||
        importEntry.target.kind === "runtime"
      ) {
        continue;
      }
      const resolvedId = resolveGraphModuleId(
        importEntry.target.moduleId,
        moduleIdentities,
      );
      node.deps.push(resolvedId);
      node.resolvedSources.set(sourceLookupKey(importEntry), resolvedId);
      if (importEntry.condition) {
        const existing = node.conditionalDeps.get(resolvedId);
        node.conditionalDeps.set(
          resolvedId,
          existing
            ? combineOr([existing, importEntry.condition])
            : importEntry.condition,
        );
        const conditionalImport = node.irHeader.conditionalImports.find(
          (item) => item.source === importEntry.source,
        );
        const elseSource = conditionalImport?.elseSource;
        if (elseSource && conditionalImport?.elseTarget?.kind === "file") {
          const elseResolvedId = resolveGraphModuleId(
            conditionalImport.elseTarget.moduleId,
            moduleIdentities,
          );
          node.deps.push(elseResolvedId);
          node.resolvedSources.set(
            sourceLookupKey({
              source: elseSource,
              request: conditionalImport.elseRequest,
              target: conditionalImport.elseTarget,
            }),
            elseResolvedId,
          );
          const elseCondition = { NOT: importEntry.condition };
          const existingElse = node.conditionalDeps.get(elseResolvedId);
          node.conditionalDeps.set(
            elseResolvedId,
            existingElse
              ? combineOr([existingElse, elseCondition])
              : elseCondition,
          );
        }
      } else {
        node.unconditionalDeps.add(resolvedId);
      }
    }
    for (const star of node.irHeader.exportStars) {
      if (star.target.kind === "runtime") {
        continue;
      }
      const resolvedId = resolveGraphModuleId(
        star.target.moduleId,
        moduleIdentities,
      );
      node.deps.push(resolvedId);
      node.unconditionalDeps.add(resolvedId);
      node.resolvedSources.set(sourceLookupKey(star), resolvedId);
    }
    for (const reexport of node.irHeader.reexportsNamed) {
      if (reexport.target.kind === "runtime") {
        continue;
      }
      const resolvedId = resolveGraphModuleId(
        reexport.target.moduleId,
        moduleIdentities,
      );
      node.deps.push(resolvedId);
      node.unconditionalDeps.add(resolvedId);
      node.resolvedSources.set(sourceLookupKey(reexport), resolvedId);
    }
  }

  for (const node of nodes.values()) {
    const unique = Array.from(new Set(node.deps));
    node.deps = unique;
  }

  return { envId: input.envId, nodes, moduleIdentities };
}

function resolveGraphModuleId(
  moduleId: string,
  moduleIdentities: Map<string, string>,
): string {
  return moduleIdentities.get(moduleId) ?? moduleId;
}
