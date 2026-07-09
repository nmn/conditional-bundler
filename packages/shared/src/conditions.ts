export type ConditionExpr =
  | string
  | { AND: ConditionExpr[] }
  | { OR: ConditionExpr[] }
  | { NOT: ConditionExpr };

export function isCompoundCondition(
  condition: ConditionExpr,
): condition is { AND: ConditionExpr[] } | { OR: ConditionExpr[] } {
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
  if ("NOT" in condition) {
    return { NOT: normalizeCondition(condition.NOT) };
  }
  return condition;
}

export function extractConditionNames(condition: ConditionExpr): string[] {
  const names = new Set<string>();
  visitCondition(condition, (name) => names.add(name));
  return Array.from(names).sort();
}

export function evaluateConditionExpr(
  condition: ConditionExpr,
  evaluateCondition: (name: string) => boolean,
): boolean {
  if (typeof condition === "string") {
    const value = evaluateCondition(condition);
    if (typeof value !== "boolean") {
      throw new Error(`Condition '${condition}' did not resolve to a boolean.`);
    }
    return value;
  }
  if ("AND" in condition) {
    return condition.AND.every((part) =>
      evaluateConditionExpr(part, evaluateCondition),
    );
  }
  if ("OR" in condition) {
    return condition.OR.some((part) =>
      evaluateConditionExpr(part, evaluateCondition),
    );
  }
  if ("NOT" in condition) {
    return !evaluateConditionExpr(condition.NOT, evaluateCondition);
  }
  throw new Error(`Invalid condition expression: ${JSON.stringify(condition)}`);
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

function visitCondition(
  condition: ConditionExpr,
  visit: (name: string) => void,
): void {
  if (typeof condition === "string") {
    visit(condition);
    return;
  }
  if ("AND" in condition) {
    for (const part of condition.AND) {
      visitCondition(part, visit);
    }
    return;
  }
  if ("OR" in condition) {
    for (const part of condition.OR) {
      visitCondition(part, visit);
    }
    return;
  }
  if ("NOT" in condition) {
    visitCondition(condition.NOT, visit);
  }
}

export function combineAnd(conditions: ConditionExpr[]): ConditionExpr {
  const flattened: ConditionExpr[] = [];
  for (const condition of conditions) {
    if (typeof condition === "object" && condition && "AND" in condition) {
      flattened.push(...condition.AND);
    } else {
      flattened.push(condition);
    }
  }
  if (flattened.length === 1) {
    return flattened[0];
  }
  return { AND: flattened };
}
