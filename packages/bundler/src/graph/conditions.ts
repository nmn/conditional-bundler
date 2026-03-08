import type { Diagnostic, ConditionExpr, ModuleNode } from "@bundler/shared";
import { combineAnd, combineOr } from "@bundler/shared";
import type { ModuleGraph } from "./build.js";

type ConditionState = {
  unconditional: boolean;
  conditional: ConditionExpr[];
};

export type GraphConditionResolution = {
  conditions: Map<string, ConditionExpr | undefined>;
  diagnostics: Diagnostic[];
};

export function normalizeGraphConditions(graph: ModuleGraph): void {
  for (const node of graph.nodes.values()) {
    node.condition = undefined;
  }
}

export function resolveEntryConditions(
  graph: ModuleGraph,
  entryId: string,
): GraphConditionResolution {
  const ordered = topoSortReachable(graph, entryId).reverse();
  const states = new Map<string, ConditionState>();
  const conditions = new Map<string, ConditionExpr | undefined>();
  const diagnostics: Diagnostic[] = [];

  if (!graph.nodes.has(entryId)) {
    return { conditions, diagnostics };
  }

  mergeState(states, entryId, undefined);

  for (const node of ordered) {
    const state = states.get(node.id);
    if (!state) {
      continue;
    }

    const nodeCondition = state.unconditional
      ? undefined
      : state.conditional.length > 0
        ? combineOr(state.conditional)
        : undefined;
    conditions.set(node.id, nodeCondition);
    node.condition = nodeCondition;

    if (state.unconditional && state.conditional.length > 0) {
      diagnostics.push({
        code: "W_CONDITIONAL_ESCAPED",
        message:
          "Module is reachable both conditionally and unconditionally; emitting it unconditionally.",
        severity: "warning",
        file: node.id,
        envId: graph.envId,
      });
    }

    for (const dep of node.deps) {
      if (node.unconditionalDeps.has(dep)) {
        mergeState(states, dep, nodeCondition);
      }

      const edgeCondition = node.conditionalDeps.get(dep);
      if (edgeCondition) {
        mergeState(states, dep, combinePathCondition(nodeCondition, edgeCondition));
      }
    }
  }

  return { conditions, diagnostics };
}

function combinePathCondition(
  inherited: ConditionExpr | undefined,
  edgeCondition: ConditionExpr,
): ConditionExpr {
  return inherited
    ? combineAnd([inherited, edgeCondition])
    : edgeCondition;
}

function mergeState(
  states: Map<string, ConditionState>,
  moduleId: string,
  condition: ConditionExpr | undefined,
): void {
  const current = states.get(moduleId) ?? {
    unconditional: false,
    conditional: [],
  };

  if (condition === undefined) {
    current.unconditional = true;
  } else {
    current.conditional.push(condition);
  }

  states.set(moduleId, current);
}

function topoSortReachable(graph: ModuleGraph, entryId: string): ModuleNode[] {
  const visited = new Set<string>();
  const ordered: ModuleNode[] = [];

  function visit(id: string): void {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const node = graph.nodes.get(id);
    if (!node) {
      return;
    }
    for (const dep of node.deps) {
      visit(dep);
    }
    ordered.push(node);
  }

  visit(entryId);
  return ordered;
}
