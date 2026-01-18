import type { ConditionExpr } from "@bundler/shared";

export function emitConditionalStart(condition: ConditionExpr): string {
  return `/////##CONDITION_START##${JSON.stringify(condition)}`;
}

export function emitConditionalEnd(): string {
  return "/////##CONDITION_END##";
}
