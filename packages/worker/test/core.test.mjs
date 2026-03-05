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

test("renames top-level bindings", async () => {
  const result = await transformSnapshot(
    "export const value = 1; const local = 2;",
  );
  expect(result.code).toMatchInlineSnapshot(`
"const ji19ybwd_value = 1;
const ji19ybwd_local = 2;"
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
      "exported": "value",
      "kind": "var",
      "local": "value",
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
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [
    {
      "exported": "value",
      "kind": "var",
      "local": "value",
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
