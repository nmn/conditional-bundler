import path from "node:path";

const pkgRoot = "/fixture";
const defaultFilePath = path.posix.join(pkgRoot, "src/index.js");

async function transform(code, filePath = defaultFilePath, root = pkgRoot) {
  const { transformWithCore } = await import("../dist/transform/core.js");
  return transformWithCore(
    {
      code,
      realPath: filePath,
      pkg: { name: "fixture", version: "0.0.0", root },
      syntax: { jsx: false, ts: false },
      envs: ["browser"],
    },
    {
      importAttrAllow: ["json"],
    },
  );
}

async function transformSnapshot(
  code,
  filePath = defaultFilePath,
  root = pkgRoot,
) {
  const result = await transform(code, filePath, root);
  return {
    code: result.code,
    meta: result.meta,
  };
}

test("rewrites dynamic import to constant", async () => {
  const result = await transformSnapshot(
    "export async function load() { return import('./dep.js'); }",
  );
  expect(result.code).toBe(
    `async function ji19ybwd_load() {\n  return __IMPORT_a4tfu7r6i();\n}`,
  );
  expect(result.meta).toMatchObject({
    conditionalImports: [],
    discoveredEntrypoints: ["src/dep.js"],
    dynamicImports: [
      expect.objectContaining({
        hashKey: "__IMPORT_a4tfu7r6i",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "/fixture/src/dep.js",
        external: false,
      }),
    ],
    exportsLocal: [{ exported: "load", kind: "func", local: "load" }],
    imports: [],
    reexportsNamed: [],
  });
});

test("rejects top-level await", async () => {
  await expect(transform("await Promise.resolve(1);")).rejects.toThrow("E_TLA");
});
