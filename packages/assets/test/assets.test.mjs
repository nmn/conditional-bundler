import {
  createOptionSet,
  createEnvironmentConditionEvaluator,
  resolveOptionKey,
  transformConditionalBundle,
} from "../dist/index.js";

test("resolves boolean flags and environment value predicates", () => {
  const evaluate = createEnvironmentConditionEvaluator({
    DEV: "1",
    DEBUG: "true",
    NODE_ENV: "production",
  });

  expect(evaluate("DEV")).toBe(true);
  expect(evaluate("DEBUG")).toBe(false);
  expect(evaluate("MISSING")).toBe(false);
  expect(evaluate("env:NODE_ENV=production")).toBe(true);
  expect(evaluate("env:NODE_ENV=development")).toBe(false);
  expect(() => evaluate("env:NODE_ENV")).toThrow("Expected 'env:NAME=value'");
});

test("creates a minimal sorted option set from bundle markers", () => {
  const code = [
    '/////##CONDITION_START##{"AND":["B","A"]}',
    "const value = 1;",
    "/////##CONDITION_END##",
    '/////##CONDITION_START##{"NOT":"A"}',
    "const fallback = 2;",
    "/////##CONDITION_END##",
  ].join("\n");

  expect(createOptionSet(code)).toEqual({ conditions: ["A", "B"] });
});

test("resolves stable bitset option keys", () => {
  const calls = [];
  const resolved = resolveOptionKey({ conditions: ["A", "B", "C"] }, (name) => {
    calls.push(name);
    return name !== "B";
  });

  expect(calls).toEqual(["A", "B", "C"]);
  expect(resolved).toEqual({
    key: "5",
    values: { A: true, B: false, C: true },
  });
});

test("replaces failing blocks and marker lines with position-stable whitespace", async () => {
  const lines = [
    "const always = 1;",
    '/////##CONDITION_START##{"AND":["A",{"NOT":"B"}]}',
    "const kept = 2;",
    "/////##CONDITION_END##",
    '/////##CONDITION_START##"B"',
    "const removed = 3;",
    "/////##CONDITION_END##",
  ];
  const code = lines.join("\n");

  const result = await transformConditionalBundle(code, (name) => name === "A");

  expect(result.optionSet).toEqual({ conditions: ["A", "B"] });
  expect(result.optionKey).toBe("1");
  expect(result.cached).toBe(false);
  expect(result.code).toHaveLength(code.length);
  expect(result.code.split("\n")).toEqual([
    lines[0],
    " ".repeat(lines[1].length),
    lines[2],
    " ".repeat(lines[3].length),
    " ".repeat(lines[4].length),
    " ".repeat(lines[5].length),
    " ".repeat(lines[6].length),
  ]);
  expect(result.code).not.toContain("CONDITION_");
});

test("preserves CRLF separators and UTF-16 columns", async () => {
  const removed = 'const message = "🚀";';
  const code = [
    '/////##CONDITION_START##"DEV"',
    removed,
    "/////##CONDITION_END##",
    "const after = 1;",
  ].join("\r\n");

  const result = await transformConditionalBundle(code, () => false);
  const outputLines = result.code.split("\r\n");

  expect(result.code).toHaveLength(code.length);
  expect(result.code.match(/\r\n/g)).toHaveLength(3);
  expect(outputLines[1]).toBe(" ".repeat(removed.length));
  expect(outputLines[3]).toBe("const after = 1;");
});

test("uses cached conditional bundle permutations", async () => {
  const cache = new Map([["1", "cached-code"]]);
  const result = await transformConditionalBundle(
    '/////##CONDITION_START##"A"\nconst value = 1;\n/////##CONDITION_END##',
    (name) => name === "A",
    {
      cache: {
        get: (key) => cache.get(key),
        set: (key, value) => cache.set(key, value),
      },
    },
  );

  expect(result.cached).toBe(true);
  expect(result.code).toBe("cached-code");
});
