import {
  createOptionSet,
  resolveOptionKey,
  transformConditionalBundle,
} from "../dist/index.js";

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

test("strips failing conditional blocks and removes marker lines", async () => {
  const code = [
    "const always = 1;",
    '/////##CONDITION_START##{"AND":["A",{"NOT":"B"}]}',
    "const kept = 2;",
    "/////##CONDITION_END##",
    '/////##CONDITION_START##"B"',
    "const removed = 3;",
    "/////##CONDITION_END##",
  ].join("\n");

  const result = await transformConditionalBundle(code, (name) => name === "A");

  expect(result.optionSet).toEqual({ conditions: ["A", "B"] });
  expect(result.optionKey).toBe("1");
  expect(result.cached).toBe(false);
  expect(result.code).toBe(["const always = 1;", "const kept = 2;"].join("\n"));
  expect(result.code).not.toContain("CONDITION_");
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
