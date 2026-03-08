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

test("records import use ranges", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js'; const value = foo + 1;",
  );
  expect(result.code).toBe("const ji19ybwd_value = a4tfu7r6i_foo + 1;");
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": false,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [
    {
      "attributes": undefined,
      "condition": undefined,
      "isDefault": false,
      "isNamespace": false,
      "kind": "value",
      "request": "./dep.js",
      "source": "src/dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "foo",
          "useRanges": [],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});

test("captures conditional import attributes", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js' with { condition: 'COND_A' }; export const value = foo;",
  );
  expect(result.code).toMatchInlineSnapshot(`
"/////##CONDITION_START##"COND_A"
const ji19ybwd_foo = a4tfu7r6i_foo;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const ji19ybwd_foo = undefined;
/////##CONDITION_END##
const ji19ybwd_value = ji19ybwd_foo;"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [
    {
      "condition": "COND_A",
      "elseRequest": undefined,
      "elseSource": undefined,
      "request": "./dep.js",
      "source": "src/dep.js",
    },
  ],
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
  "imports": [
    {
      "attributes": undefined,
      "condition": "COND_A",
      "isDefault": false,
      "isNamespace": false,
      "kind": "value",
      "request": "./dep.js",
      "source": "src/dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "foo",
          "useRanges": [],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});

test("handles conditional else attributes", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js' with { condition: 'COND_A', else: './alt.js' }; export const value = foo;",
  );
  expect(result.code).toMatchInlineSnapshot(`
"/////##CONDITION_START##"COND_A"
const ji19ybwd_foo = a4tfu7r6i_foo;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const ji19ybwd_foo = a594tohci_foo;
/////##CONDITION_END##
const ji19ybwd_value = ji19ybwd_foo;"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [
    {
      "condition": "COND_A",
      "elseRequest": "./alt.js",
      "elseSource": "src/alt.js",
      "request": "./dep.js",
      "source": "src/dep.js",
    },
  ],
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
  "imports": [
    {
      "attributes": undefined,
      "condition": "COND_A",
      "isDefault": false,
      "isNamespace": false,
      "kind": "value",
      "request": "./dep.js",
      "source": "src/dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "foo",
          "useRanges": [],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});

test("marks namespace dynamic usage", async () => {
  const result = await transformSnapshot(
    "import * as ns from './dep.js'; const value = ns['foo'];",
  );
  expect(result.code).toBe("const ji19ybwd_value = __NS__a4tfu7r6i['foo'];");
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": true,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [
    {
      "attributes": undefined,
      "condition": undefined,
      "isDefault": false,
      "isNamespace": true,
      "kind": "value",
      "namespaceUsage": "dynamic",
      "request": "./dep.js",
      "source": "src/dep.js",
      "specifiers": [
        {
          "imported": "*",
          "local": "ns",
          "useRanges": [],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});

test("captures namespace import static usage", async () => {
  const result = await transformSnapshot(
    "import * as ns from './dep.js'; const value = ns.foo + ns.bar;",
  );
  expect(result.code).toBe(
    "const ji19ybwd_value = a4tfu7r6i_foo + a4tfu7r6i_bar;",
  );
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [],
  "flags": {
    "hasTopLevelAwait": false,
    "needsNamespaceObject": false,
    "sideEffects": true,
  },
  "importRanges": [],
  "imports": [
    {
      "attributes": undefined,
      "condition": undefined,
      "isDefault": false,
      "isNamespace": true,
      "kind": "value",
      "namespaceUsage": "static",
      "request": "./dep.js",
      "source": "src/dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "ns",
          "useRanges": [],
        },
        {
          "imported": "bar",
          "local": "ns",
          "useRanges": [],
        },
      ],
    },
  ],
  "reexportsNamed": [],
}
`);
});
