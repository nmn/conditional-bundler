export type ConditionExpr = string | {
    AND: ConditionExpr[];
} | {
    OR: ConditionExpr[];
};
export declare function isCompoundCondition(condition: ConditionExpr): condition is {
    AND: ConditionExpr[];
} | {
    OR: ConditionExpr[];
};
export declare function normalizeCondition(condition: ConditionExpr): ConditionExpr;
export declare function combineOr(conditions: ConditionExpr[]): ConditionExpr;
export declare function combineAnd(conditions: ConditionExpr[]): ConditionExpr;
//# sourceMappingURL=conditions.d.ts.map