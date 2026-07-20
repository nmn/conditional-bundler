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

export type ConditionEvaluator = (name: string) => boolean | Promise<boolean>;

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

export async function resolveOptionKey(
  optionSet: OptionSet,
  evaluateCondition: ConditionEvaluator,
): Promise<ResolvedOptions> {
  let bits = 0n;
  const values: Record<string, boolean> = {};

  const resolvedValues = await Promise.all(
    optionSet.conditions.map((name) => evaluateCondition(name)),
  );
  resolvedValues.forEach((value, index) => {
    const name = optionSet.conditions[index];
    if (typeof value !== "boolean") {
      throw new Error(`Condition '${name}' did not resolve to a boolean.`);
    }
    values[name] = value;
    if (value) {
      bits |= 1n << BigInt(index);
    }
  });

  return {
    key: formatOptionKey(optionSet, bits),
    values,
  };
}

export async function transformConditionalBundle(
  bundleCode: string,
  evaluateCondition: ConditionEvaluator,
  options: TransformConditionalBundleOptions = {},
): Promise<TransformConditionalBundleResult> {
  const optionSet = options.optionSet ?? createOptionSet(bundleCode);
  const resolved = await resolveOptionKey(optionSet, evaluateCondition);
  return transformConditionalBundleWithOptions(
    bundleCode,
    optionSet,
    resolved,
    options,
  );
}

export async function transformConditionalBundleById(
  bundleCode: string,
  optionSet: OptionSet,
  optionKey: string,
  options: Omit<TransformConditionalBundleOptions, "optionSet"> = {},
): Promise<TransformConditionalBundleResult> {
  return transformConditionalBundleWithOptions(
    bundleCode,
    optionSet,
    decodeOptionKey(optionSet, optionKey),
    options,
  );
}

async function transformConditionalBundleWithOptions(
  bundleCode: string,
  optionSet: OptionSet,
  resolved: ResolvedOptions,
  options: Omit<TransformConditionalBundleOptions, "optionSet">,
): Promise<TransformConditionalBundleResult> {
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

export function optionKeyWidth(optionSet: OptionSet): number {
  return maxOptionKey(optionSet).toString(10).length;
}

export function formatOptionKey(
  optionSet: OptionSet,
  value: bigint | number | string,
): string {
  const numeric = parseOptionKeyValue(value);
  const maximum = maxOptionKey(optionSet);
  if (numeric < 0n || numeric > maximum) {
    throw new Error(
      `Condition ID '${String(value)}' is outside the valid range 0-${maximum.toString(10)}.`,
    );
  }
  return numeric.toString(10).padStart(optionKeyWidth(optionSet), "0");
}

export function decodeOptionKey(
  optionSet: OptionSet,
  optionKey: string,
): ResolvedOptions {
  if (
    !/^\d+$/.test(optionKey) ||
    optionKey.length !== optionKeyWidth(optionSet)
  ) {
    throw new Error(`Invalid condition ID '${optionKey}'.`);
  }
  const bits = BigInt(optionKey);
  if (formatOptionKey(optionSet, bits) !== optionKey) {
    throw new Error(`Invalid condition ID '${optionKey}'.`);
  }
  const values: Record<string, boolean> = {};
  optionSet.conditions.forEach((name, index) => {
    values[name] = (bits & (1n << BigInt(index))) !== 0n;
  });
  return { key: optionKey, values };
}

export function conditionIdPlaceholder(optionSet: OptionSet): string {
  return "x".repeat(optionKeyWidth(optionSet));
}

export function withConditionId(
  url: string,
  optionSet: OptionSet,
  optionKey: string,
): string {
  return insertConditionId(url, formatOptionKey(optionSet, optionKey));
}

export function withConditionIdPlaceholder(
  url: string,
  optionSet: OptionSet,
): string {
  return insertConditionId(url, conditionIdPlaceholder(optionSet));
}

export function applyConditionIdToUrl(
  url: string,
  optionSet: OptionSet,
  optionKey: string,
): string {
  const placeholder = conditionIdPlaceholder(optionSet);
  const formatted = formatOptionKey(optionSet, optionKey);
  return url.split(`.id-${placeholder}.`).join(`.id-${formatted}.`);
}

export function parseConditionIdUrl(
  url: string,
  optionSet: OptionSet,
): { url: string; optionKey: string; values: Record<string, boolean> } | null {
  const match = /^(.*)\.id-(\d+)(\.[cm]?js)([?#].*)?$/.exec(url);
  if (!match) return null;
  const resolved = decodeOptionKey(optionSet, match[2]);
  return {
    url: `${match[1]}${match[3]}${match[4] ?? ""}`,
    optionKey: resolved.key,
    values: resolved.values,
  };
}

export function createUserAgentConditionEvaluator(
  userAgent: string | undefined,
): (name: string) => boolean {
  const value = userAgent ?? "";
  const isFirefox = /\b(?:Firefox|FxiOS)\//i.test(value);
  const isChrome =
    /\b(?:Chrome|CriOS)\//i.test(value) &&
    !/\b(?:Edg|EdgiOS|OPR|SamsungBrowser)\//i.test(value);
  const isSafari =
    /\bSafari\//i.test(value) &&
    !isChrome &&
    !isFirefox &&
    !/\b(?:Chromium|Android)\b/i.test(value);
  const conditions: Record<string, boolean> = {
    isChrome,
    isFirefox,
    isSafari,
  };
  return (name) => conditions[name] ?? false;
}

export async function resolveUserAgentOptionKey(
  optionSet: OptionSet,
  userAgent: string | undefined,
): Promise<ResolvedOptions> {
  return resolveOptionKey(
    optionSet,
    createUserAgentConditionEvaluator(userAgent),
  );
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

function maxOptionKey(optionSet: OptionSet): bigint {
  return (1n << BigInt(optionSet.conditions.length)) - 1n;
}

function parseOptionKeyValue(value: bigint | number | string): bigint {
  if (
    (typeof value === "number" &&
      (!Number.isSafeInteger(value) || value < 0)) ||
    (typeof value === "string" && !/^\d+$/.test(value))
  ) {
    throw new Error(`Invalid condition ID '${String(value)}'.`);
  }
  return BigInt(value);
}

function insertConditionId(url: string, optionKey: string): string {
  if (/\.id-[^.]+\.[cm]?js(?:[?#]|$)/.test(url)) {
    throw new Error(`URL '${url}' already contains a condition ID.`);
  }
  const match = /(\.[cm]?js)([?#].*)?$/.exec(url);
  if (!match || match.index == null) {
    throw new Error(
      `Conditional script URL '${url}' must end in .js, .mjs, or .cjs.`,
    );
  }
  return `${url.slice(0, match.index)}.id-${optionKey}${match[1]}${match[2] ?? ""}`;
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
