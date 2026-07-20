import {
  applyConditionIdToUrl,
  createOptionSet,
  createEnvironmentConditionEvaluator,
  decodeOptionKey,
  parseConditionIdUrl,
  resolveOptionKey,
  resolveUserAgentOptionKey,
  transformConditionalBundle,
  transformConditionalBundleById,
  withConditionIdPlaceholder,
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

test("resolves stable bitset option keys", async () => {
  const calls = [];
  const resolved = await resolveOptionKey(
    { conditions: ["A", "B", "C"] },
    (name) => {
      calls.push(name);
      return name !== "B";
    },
  );

  expect(calls).toEqual(["A", "B", "C"]);
  expect(resolved).toEqual({
    key: "5",
    values: { A: true, B: false, C: true },
  });
});

test("resolves conditions concurrently and accepts every independent permutation", async () => {
  const optionSet = {
    conditions: ["isChrome", "isFirefox", "isSafari"],
  };
  const pending = [];
  const resolution = resolveOptionKey(optionSet, (name) => {
    return new Promise((resolve) => pending.push({ name, resolve }));
  });
  expect(pending.map((item) => item.name)).toEqual(optionSet.conditions);
  pending[2].resolve(true);
  pending[0].resolve(true);
  pending[1].resolve(false);
  await expect(resolution).resolves.toEqual({
    key: "5",
    values: { isChrome: true, isFirefox: false, isSafari: true },
  });

  for (let id = 0; id < 8; id += 1) {
    expect(decodeOptionKey(optionSet, String(id)).key).toBe(String(id));
  }
  expect(() => decodeOptionKey(optionSet, "8")).toThrow("outside");
  expect(() => decodeOptionKey(optionSet, "01")).toThrow("Invalid");
});

test.each([
  ["1", "Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36"],
  ["2", "Mozilla/5.0 Firefox/128.0"],
  ["4", "Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15"],
  ["0", "curl/8.7.1"],
])("maps browser user agents to condition ID %s", async (key, userAgent) => {
  await expect(
    resolveUserAgentOptionKey(
      { conditions: ["isChrome", "isFirefox", "isSafari"] },
      userAgent,
    ),
  ).resolves.toMatchObject({ key });
});

test("adds and resolves fixed-width condition IDs in script URLs", () => {
  const optionSet = { conditions: ["A", "B", "C"] };
  const placeholder = withConditionIdPlaceholder("/assets/app.js", optionSet);
  expect(placeholder).toBe("/assets/app.id-x.js");
  expect(applyConditionIdToUrl(placeholder, optionSet, "4")).toBe(
    "/assets/app.id-4.js",
  );
  expect(parseConditionIdUrl("/assets/app.id-4.js", optionSet)).toEqual({
    url: "/assets/app.js",
    optionKey: "4",
    values: { A: false, B: false, C: true },
  });

  const wider = { conditions: ["A", "B", "C", "D"] };
  expect(withConditionIdPlaceholder("app.js", wider)).toBe("app.id-xx.js");
  expect(applyConditionIdToUrl("app.id-xx.js", wider, "1")).toBe(
    "app.id-01.js",
  );
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

test("materializes a bundle from an explicit condition ID", async () => {
  const source = [
    '/////##CONDITION_START##"isChrome"',
    'const selected = "chrome";',
    "/////##CONDITION_END##",
    '/////##CONDITION_START##{"NOT":"isChrome"}',
    'const selected = "other";',
    "/////##CONDITION_END##",
  ].join("\n");
  const result = await transformConditionalBundleById(
    source,
    { conditions: ["isChrome", "isFirefox", "isSafari"] },
    "1",
  );
  expect(result.code).toHaveLength(source.length);
  expect(result.code).toContain('const selected = "chrome";');
  expect(result.code).not.toContain('const selected = "other";');
});
