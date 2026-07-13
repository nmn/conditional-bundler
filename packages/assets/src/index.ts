import {
  evaluateConditionExpr,
  extractConditionNames,
  type ConditionExpr,
} from "@bundler/shared/runtime";

const CONDITION_START = "/////##CONDITION_START##";
const CONDITION_END = "/////##CONDITION_END##";

export type OptionSet = {
  conditions: string[];
};

export type ResolvedOptions = {
  key: string;
  values: Record<string, boolean>;
};

export type ConditionalBundleCache = {
  get: (key: string) => string | Promise<string | undefined> | undefined;
  set?: (key: string, value: string) => void | Promise<void>;
};

export type TransformConditionalBundleOptions = {
  optionSet?: OptionSet;
  cache?: ConditionalBundleCache;
};

export type TransformConditionalBundleResult = {
  code: string;
  optionSet: OptionSet;
  optionKey: string;
  cached: boolean;
};

export function createEnvironmentConditionEvaluator(
  environment: Readonly<Record<string, string | undefined>>,
): (name: string) => boolean {
  return (name) => {
    if (!name.startsWith("env:")) {
      return environment[name] === "1";
    }
    const match = /^env:([A-Za-z_][A-Za-z0-9_]*)=(.+)$/.exec(name);
    if (!match) {
      throw new Error(
        `Invalid environment condition '${name}'. Expected 'env:NAME=value'.`,
      );
    }
    return environment[match[1]] === match[2];
  };
}

export function createOptionSet(
  input:
    | string
    | {
        conditions?: string[];
        code?: string;
      },
): OptionSet {
  if (typeof input !== "string") {
    if (input.conditions) {
      return { conditions: Array.from(new Set(input.conditions)).sort() };
    }
    if (input.code != null) {
      return createOptionSet(input.code);
    }
    return { conditions: [] };
  }

  const names = new Set<string>();
  for (const condition of scanConditionExpressions(input)) {
    for (const name of extractConditionNames(condition)) {
      names.add(name);
    }
  }
  return { conditions: Array.from(names).sort() };
}

export function resolveOptionKey(
  optionSet: OptionSet,
  evaluateCondition: (name: string) => boolean,
): ResolvedOptions {
  let bits = 0n;
  const values: Record<string, boolean> = {};

  optionSet.conditions.forEach((name, index) => {
    const value = evaluateCondition(name);
    if (typeof value !== "boolean") {
      throw new Error(`Condition '${name}' did not resolve to a boolean.`);
    }
    values[name] = value;
    if (value) {
      bits |= 1n << BigInt(index);
    }
  });

  return {
    key: optionSet.conditions.length === 0 ? "0" : bits.toString(16),
    values,
  };
}

export async function transformConditionalBundle(
  bundleCode: string,
  evaluateCondition: (name: string) => boolean,
  options: TransformConditionalBundleOptions = {},
): Promise<TransformConditionalBundleResult> {
  const optionSet = options.optionSet ?? createOptionSet(bundleCode);
  const resolved = resolveOptionKey(optionSet, evaluateCondition);
  const cached = await options.cache?.get(resolved.key);
  if (cached != null) {
    return {
      code: cached,
      optionSet,
      optionKey: resolved.key,
      cached: true,
    };
  }

  const code = stripConditionalBlocks(bundleCode, (condition) =>
    evaluateConditionExpr(
      condition,
      (name) => resolved.values[name] as boolean,
    ),
  );
  await options.cache?.set?.(resolved.key, code);
  return {
    code,
    optionSet,
    optionKey: resolved.key,
    cached: false,
  };
}

export function stripConditionalBlocks(
  bundleCode: string,
  evaluateExpression: (condition: ConditionExpr) => boolean,
): string {
  const segments = bundleCode.split(/(\r\n|\n|\r)/);
  const stack: Array<{ active: boolean }> = [];
  const output: string[] = [];

  for (let index = 0; index < segments.length; index += 2) {
    const line = segments[index];
    const marker = readMarker(line);
    if (marker?.type === "start") {
      const active = evaluateExpression(marker.condition);
      stack.push({ active });
      output.push(maskLine(line));
    } else if (marker?.type === "end") {
      if (stack.length === 0) {
        throw new Error("Encountered CONDITION_END without CONDITION_START.");
      }
      stack.pop();
      output.push(maskLine(line));
    } else if (stack.every((entry) => entry.active)) {
      output.push(line);
    } else {
      output.push(maskLine(line));
    }
    if (index + 1 < segments.length) {
      output.push(segments[index + 1]);
    }
  }

  if (stack.length > 0) {
    throw new Error("Encountered CONDITION_START without CONDITION_END.");
  }

  return output.join("");
}

function maskLine(line: string): string {
  return " ".repeat(line.length);
}

function scanConditionExpressions(bundleCode: string): ConditionExpr[] {
  const conditions: ConditionExpr[] = [];
  for (const line of bundleCode.split(/\r?\n/)) {
    const marker = readMarker(line);
    if (marker?.type === "start") {
      conditions.push(marker.condition);
    }
  }
  return conditions;
}

function readMarker(
  line: string,
): { type: "start"; condition: ConditionExpr } | { type: "end" } | null {
  const trimmed = line.trim();
  if (trimmed.startsWith(CONDITION_START)) {
    const raw = trimmed.slice(CONDITION_START.length);
    try {
      return { type: "start", condition: JSON.parse(raw) as ConditionExpr };
    } catch {
      throw new Error(`Invalid condition marker: ${line}`);
    }
  }
  if (trimmed === CONDITION_END) {
    return { type: "end" };
  }
  return null;
}
