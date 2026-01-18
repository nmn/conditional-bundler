export type ConditionExpr = string | { AND: ConditionExpr[] } | { OR: ConditionExpr[] };

export function isCompoundCondition(condition: ConditionExpr): condition is { AND: ConditionExpr[] } | { OR: ConditionExpr[] } {
  return typeof condition === "object" && condition !== null;
}

export function normalizeCondition(condition: ConditionExpr): ConditionExpr {
  if (typeof condition === "string") {
    return condition;
  }
  if ("AND" in condition) {
    const parts = condition.AND.map(normalizeCondition);
    return { AND: parts };
  }
  if ("OR" in condition) {
    const parts = condition.OR.map(normalizeCondition);
    return { OR: parts };
  }
  return condition;
}

export function combineOr(conditions: ConditionExpr[]): ConditionExpr {
  const flattened: ConditionExpr[] = [];
  for (const condition of conditions) {
    if (typeof condition === "object" && condition && "OR" in condition) {
      flattened.push(...condition.OR);
    } else {
      flattened.push(condition);
    }
  }
  if (flattened.length === 1) {
    return flattened[0];
  }
  return { OR: flattened };
}
