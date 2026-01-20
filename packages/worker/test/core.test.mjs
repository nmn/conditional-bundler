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

async function transformSnapshot(code, filePath = "index.js") {
  const result = await transform(code, filePath);
  return {
    code: result.code,
    meta: result.meta
  };
}

test("renames top-level bindings", async () => {
  const result = await transformSnapshot("export const value = 1; const local = 2;");
  expect(result.code).toMatchInlineSnapshot(`
"const test_value = 1;
export { test_value as value };
const test_local = 2;"
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
      "local": "test_value",
    },
    {
      "exported": "value",
      "kind": "var",
      "local": "test_value",
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

test("records import use ranges", async () => {
  const result = await transformSnapshot("import { foo } from './dep.js'; const value = foo + 1;");
  expect(result.code).toMatchInlineSnapshot(`
"import { foo } from './dep.js';
const test_value = foo + 1;"
`);
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
              51,
              54,
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

test("rewrites dynamic import to constant", async () => {
  const result = await transformSnapshot("export async function load() { return import('./dep.js'); }");
  expect(result.code).toMatchInlineSnapshot(`
"async function test_load() {
  return __IMPORT_a608l0qkn();
}
export { test_load as load };"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [
    "./dep.js",
  ],
  "dynamicImports": [
    {
      "hashKey": "__IMPORT_a608l0qkn",
      "source": "./dep.js",
    },
  ],
  "exportRanges": [],
  "exportStars": [],
  "exportsLocal": [
    {
      "exported": "load",
      "kind": "var",
      "local": "test_load",
    },
    {
      "exported": "load",
      "kind": "var",
      "local": "test_load",
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

test("captures conditional import attributes", async () => {
  const result = await transformSnapshot("import { foo } from './dep.js' with { condition: 'COND_A' }; export const value = foo;");
  expect(result.code).toMatchInlineSnapshot(`
"import { foo } from './dep.js' with { condition: 'COND_A' };
const test_value = foo;
export { test_value as value };"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [
    {
      "condition": "COND_A",
      "elseSource": undefined,
      "source": "./dep.js",
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
      "local": "test_value",
    },
    {
      "exported": "value",
      "kind": "var",
      "local": "test_value",
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
      60,
    ],
  ],
  "imports": [
    {
      "attributes": undefined,
      "condition": "COND_A",
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
              80,
              83,
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

test("marks namespace dynamic usage", async () => {
  const result = await transformSnapshot("import * as ns from './dep.js'; const value = ns['foo'];");
  expect(result.code).toMatchInlineSnapshot(`
"import * as ns from './dep.js';
const test_value = ns['foo'];"
`);
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
      "isNamespace": true,
      "kind": "value",
      "namespaceUsage": "dynamic",
      "source": "./dep.js",
      "specifiers": [
        {
          "imported": "*",
          "local": "ns",
          "useRanges": [
            [
              51,
              53,
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

test("rejects top-level await", async () => {
  await expect(transform("await Promise.resolve(1);"))
    .rejects
    .toThrow("E_TLA");
});

test("keeps export declaration shape", async () => {
  const result = await transformSnapshot("export const foo = 42;");
  expect(result.code).toMatchInlineSnapshot(`
"const test_foo = 42;
export { test_foo as foo };"
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
      "exported": "foo",
      "kind": "var",
      "local": "test_foo",
    },
    {
      "exported": "foo",
      "kind": "var",
      "local": "test_foo",
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
  const result = await transformSnapshot("export default function foo() { return 1; }");
  expect(result.code).toMatchInlineSnapshot(`
"function test_foo() {
  return 1;
}
export { test_foo as default };"
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
      "kind": "var",
      "local": "test_foo",
    },
    {
      "exported": "default",
      "kind": "var",
      "local": "test_foo",
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
  const result = await transformSnapshot("export * from './dep.js'; export { foo as bar } from './dep.js';");
  expect(result.code).toMatchInlineSnapshot(`
"export * from './dep.js';
export { foo as bar } from './dep.js';"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [],
  "discoveredEntrypoints": [],
  "dynamicImports": [],
  "exportRanges": [
    [
      0,
      25,
    ],
    [
      26,
      64,
    ],
  ],
  "exportStars": [
    {
      "source": "./dep.js",
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
      "source": "./dep.js",
    },
  ],
}
`);
});

test("handles conditional else attributes", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js' with { condition: 'COND_A', else: './alt.js' }; export const value = foo;"
  );
  expect(result.code).toMatchInlineSnapshot(`
"import { foo } from './dep.js' with { condition: 'COND_A', else: './alt.js' };
const test_value = foo;
export { test_value as value };"
`);
  expect(result.meta).toMatchInlineSnapshot(`
{
  "conditionalImports": [
    {
      "condition": "COND_A",
      "elseSource": "./alt.js",
      "source": "./dep.js",
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
      "local": "test_value",
    },
    {
      "exported": "value",
      "kind": "var",
      "local": "test_value",
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
      78,
    ],
  ],
  "imports": [
    {
      "attributes": undefined,
      "condition": "COND_A",
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
              98,
              101,
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

test("captures namespace import static usage", async () => {
  const result = await transformSnapshot("import * as ns from './dep.js'; const value = ns.foo + ns.bar;");
  expect(result.code).toMatchInlineSnapshot(`
"import * as ns from './dep.js';
const test_value = ns.foo + ns.bar;"
`);
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
      "isNamespace": true,
      "kind": "value",
      "namespaceUsage": "static",
      "source": "./dep.js",
      "specifiers": [
        {
          "imported": "foo",
          "local": "ns",
          "useRanges": [
            [
              51,
              57,
            ],
          ],
        },
        {
          "imported": "bar",
          "local": "ns",
          "useRanges": [
            [
              60,
              66,
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
