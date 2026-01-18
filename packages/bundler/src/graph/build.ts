import type { ModuleNode, IRHeader } from "@bundler/shared";
import type { ConditionExpr } from "@bundler/shared";

export type ModuleGraph = {
  envId: string;
  nodes: Map<string, ModuleNode>;
};

export function buildGraph(envId: string, headers: IRHeader[]): ModuleGraph {
  const nodes = new Map<string, ModuleNode>();
  for (const header of headers) {
    nodes.set(header.id, {
      id: header.id,
      prefix: header.prefix,
      deps: [],
      conditionalDeps: new Map<string, ConditionExpr>(),
      irHeader: header
    });
  }
  return { envId, nodes };
}
