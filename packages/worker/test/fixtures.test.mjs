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
      envs: ["browser"]
    },
    {
      importAttrAllow: ["json"]
    }
  );
}

async function transformSnapshot(code, filePath = defaultFilePath, root = pkgRoot) {
  const result = await transform(code, filePath, root);
  return {
    code: result.code,
    meta: result.meta
  };
}

test.skip("transforms mixed exports and imports", async () => {
  const result = await transformSnapshot(`
    import { foo } from './dep.js';
    export const bar = foo + 1;
    export { foo };
  `);
  expect(result.code).toMatchInlineSnapshot(`
"import { foo } from './dep.js';
export const ji19ybwd_bar = foo + 1;
export { foo };"
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
      "exported": "bar",
      "kind": "var",
      "local": "ji19ybwd_bar",
    },
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
  "importRanges": [
    [
      0,
      31,
    ],
  ],
  "imports": [
    {
      "attributes": undefined,
      "condition": undefined,
      "isDefault": false,
      "isNamespace": false,
      "kind": "value",
      "source": "./dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "foo",
          "useRanges": [
            [
              55,
              58,
            ],
          ],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});
