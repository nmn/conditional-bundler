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

test("keeps export declaration shape", async () => {
  const result = await transformSnapshot("export const foo = 42;");
  expect(result.code).toMatchInlineSnapshot(`"const ji19ybwd_foo = 42;"`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [
    {
      "exported": "foo",
      "kind": "var",
      "local": "foo",
    },
  ],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": false,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [],
  "reexportsNamed": [],
}
`);
});

test("rewrites default export to renamed binding", async () => {
  const result = await transformSnapshot(
    "export default function foo() { return 1; }",
  );
  expect(result.code).toMatchInlineSnapshot(`
"const ji19ybwd_default = function ji19ybwd_foo() {
  return 1;
};"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [
    {
      "exported": "default",
      "kind": "default",
      "local": "default",
    },
  ],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": false,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [],
  "reexportsNamed": [],
}
`);
});

test("records export stars and reexports", async () => {
  const result = await transformSnapshot(
    "export * from './dep.js'; export { foo as bar } from './dep.js';",
  );
  expect(result.code).toMatchInlineSnapshot(`""`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [
    {
      "request": "./dep.js",
      "source": "src/dep.js",
      "sourceOrder": 0,
    },
  ],
  "exportsLocal": [],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": false,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [],
  "reexportsNamed": [
    {
      "exported": "bar",
      "imported": "foo",
      "request": "./dep.js",
      "source": "src/dep.js",
      "sourceOrder": 26,
    },
  ],
}
`);
});
