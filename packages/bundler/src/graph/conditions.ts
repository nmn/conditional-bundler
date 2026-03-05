import type { ModuleGraph } from "./build.js";
import type { ConditionExpr, ModuleNode } from "@bundler/shared";
import { combineOr } from "@bundler/shared";

export function normalizeGraphConditions(graph: ModuleGraph): void {
  const conditionCounts = new Map<string, ConditionExpr[]>();
  const unconditional = new Set<string>();

  for (const node of graph.nodes.values()) {
    for (const dep of node.deps) {
      const condition = node.conditionalDeps.get(dep);
      if (!condition) {
        unconditional.add(dep);
        continue;
      }
      const list = conditionCounts.get(dep) ?? [];
      list.push(condition);
      conditionCounts.set(dep, list);
    }
  }

  for (const node of graph.nodes.values()) {
    const condition = resolveNodeCondition(
      node,
      conditionCounts,
      unconditional,
    );
    node.condition = condition;
  }
}

function resolveNodeCondition(
  node: ModuleNode,
  conditionCounts: Map<string, ConditionExpr[]>,
  unconditional: Set<string>,
): ConditionExpr | undefined {
  if (unconditional.has(node.id)) {
    return undefined;
  }
  const conditions = conditionCounts.get(node.id);
  if (!conditions || conditions.length === 0) {
    return undefined;
  }
  return combineOr(conditions);
}
