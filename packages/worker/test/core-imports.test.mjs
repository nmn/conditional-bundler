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
  expect(result.meta).toMatchObject({
    conditionalImports: [],
    discoveredEntrypoints: [],
    dynamicImports: [],
    exportsLocal: [],
    flags: {
      hasTopLevelAwait: false,
      needsNamespaceObject: false,
      sideEffects: true,
    },
    imports: [
      expect.objectContaining({
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        external: false,
        kind: "value",
        isNamespace: false,
        isDefault: false,
        specifiers: [{ imported: "foo", local: "foo", useRanges: [] }],
      }),
    ],
    reexportsNamed: [],
  });
});

test("captures conditional import attributes", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js' with { condition: 'COND_A' }; export const value = foo;",
  );
  expect(result.code).toMatchInlineSnapshot(`
"let ji19ybwd_foo;
/////##CONDITION_START##"COND_A"
ji19ybwd_foo = a4tfu7r6i_foo;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
ji19ybwd_foo = undefined;
/////##CONDITION_END##
const ji19ybwd_value = ji19ybwd_foo;"
`);
  expect(result.meta).toMatchObject({
    conditionalImports: [
      expect.objectContaining({
        condition: "COND_A",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        external: false,
      }),
    ],
    exportsLocal: [{ exported: "value", kind: "var", local: "value" }],
    imports: [
      expect.objectContaining({
        condition: "COND_A",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        external: false,
      }),
    ],
  });
});

test("handles conditional else attributes", async () => {
  const result = await transformSnapshot(
    "import { foo } from './dep.js' with { condition: 'COND_A', else: './alt.js' }; export const value = foo;",
  );
  expect(result.code).toMatchInlineSnapshot(`
"let ji19ybwd_foo;
/////##CONDITION_START##"COND_A"
ji19ybwd_foo = a4tfu7r6i_foo;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
ji19ybwd_foo = a594tohci_foo;
/////##CONDITION_END##
const ji19ybwd_value = ji19ybwd_foo;"
`);
  expect(result.meta).toMatchObject({
    conditionalImports: [
      expect.objectContaining({
        condition: "COND_A",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        elseRequest: "./alt.js",
        elseSource: "src/alt.js",
        elseModuleId: "fixture@0.0.0::src/alt.js",
        external: false,
        elseExternal: false,
      }),
    ],
    exportsLocal: [{ exported: "value", kind: "var", local: "value" }],
  });
});

test("marks namespace dynamic usage", async () => {
  const result = await transformSnapshot(
    "import * as ns from './dep.js'; const value = ns['foo'];",
  );
  expect(result.code).toBe("const ji19ybwd_value = __NS__a4tfu7r6i['foo'];");
  expect(result.meta).toMatchObject({
    flags: {
      hasTopLevelAwait: false,
      needsNamespaceObject: true,
      sideEffects: true,
    },
    imports: [
      expect.objectContaining({
        namespaceUsage: "dynamic",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        external: false,
      }),
    ],
  });
});

test("captures namespace import static usage", async () => {
  const result = await transformSnapshot(
    "import * as ns from './dep.js'; const value = ns.foo + ns.bar;",
  );
  expect(result.code).toBe(
    "const ji19ybwd_value = a4tfu7r6i_foo + a4tfu7r6i_bar;",
  );
  expect(result.meta).toMatchObject({
    flags: {
      hasTopLevelAwait: false,
      needsNamespaceObject: false,
      sideEffects: true,
    },
    imports: [
      expect.objectContaining({
        namespaceUsage: "static",
        request: "./dep.js",
        source: "src/dep.js",
        moduleId: "fixture@0.0.0::src/dep.js",
        external: false,
        specifiers: [
          { imported: "foo", local: "ns", useRanges: [] },
          { imported: "bar", local: "ns", useRanges: [] },
        ],
      }),
    ],
  });
});
