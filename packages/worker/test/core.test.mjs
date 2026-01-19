import path from "node:path";

async function transform(code, filePath = "index.js") {
  const { transformWithCore } = await import("../dist/transform/core.js");
  return transformWithCore(
    {
      code,
      realPath: filePath,
      pkg: { name: "fixture", version: "0.0.0", root: path.dirname(filePath) },
      syntax: { jsx: false, ts: false },
      envs: ["browser"]
    },
    {
      prefix: "test",
      importAttrAllow: ["json"]
    }
  );
}

test("renames top-level bindings", async () => {
  const result = await transform("export const value = 1; const local = 2;");
  expect(result.code).toContain("test_value");
  expect(result.code).toContain("test_local");
});

test("records import use ranges", async () => {
  const result = await transform("import { foo } from './dep.js'; const value = foo + 1;");
  expect(result.meta.imports[0].specifiers[0].useRanges.length).toBeGreaterThan(0);
});

test("rewrites dynamic import to constant", async () => {
  const result = await transform("export async function load() { return import('./dep.js'); }");
  expect(result.code).toMatch(/__IMPORT_/);
  expect(result.meta.dynamicImports.length).toBe(1);
});

test("captures conditional import attributes", async () => {
  const result = await transform("import { foo } from './dep.js' with { condition: 'COND_A' }; export const value = foo;");
  expect(result.meta.conditionalImports[0].condition).toBe("COND_A");
});

test("marks namespace dynamic usage", async () => {
  const result = await transform("import * as ns from './dep.js'; const value = ns['foo'];");
  expect(result.meta.flags.needsNamespaceObject).toBe(true);
});

test("rejects top-level await", async () => {
  await expect(transform("await Promise.resolve(1);"))
    .rejects
    .toThrow("E_TLA");
});
