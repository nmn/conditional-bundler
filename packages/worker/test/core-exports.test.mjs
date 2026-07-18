import path from "node:path";

const pkgRoot = "/fixture";
const defaultFilePath = path.posix.join(pkgRoot, "src/index.js");

async function transform(code, filePath = defaultFilePath, root = pkgRoot) {
  const { scanImportRequests, transformWithCore } =
    await import("../dist/transform/core.js");
  const moduleIdentity = `fixture@0.0.0::${path.posix.relative(root, filePath)}`;
  const input = {
    code,
    moduleIdentity,
    canonicalPath: moduleIdentity,
    realPath: filePath,
    pkg: { name: "fixture", version: "0.0.0", root },
    syntax: { jsx: false, ts: false },
    envs: ["browser"],
  };
  return transformWithCore(
    {
      ...input,
      resolvedImports: resolveRequests(
        scanImportRequests(input),
        filePath,
        root,
      ),
    },
    {
      importAttrAllow: ["json"],
    },
  );
}

function resolveRequests(requests, filePath, root) {
  return Object.fromEntries(
    requests.map(({ key, request }) => {
      const relative = request.startsWith(".")
        ? path.posix.relative(
            root,
            path.posix.resolve(path.posix.dirname(filePath), request),
          )
        : request;
      const canonicalPath = `fixture@0.0.0::${relative}`;
      return [
        key,
        {
          target: { kind: "file", moduleId: canonicalPath, canonicalPath },
          type: "javascript",
          intent: "module",
        },
      ];
    }),
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
  expect(result.meta).toMatchObject({
    conditionalImports: [],
    discoveredEntrypoints: [],
    exportStars: [
      expect.objectContaining({
        request: "./dep.js",
        source: "src/dep.js",
        target: {
          kind: "file",
          moduleId: "fixture@0.0.0::src/dep.js",
          canonicalPath: "fixture@0.0.0::src/dep.js",
        },
        sourceOrder: 0,
      }),
    ],
    reexportsNamed: [
      expect.objectContaining({
        exported: "bar",
        imported: "foo",
        request: "./dep.js",
        source: "src/dep.js",
        target: {
          kind: "file",
          moduleId: "fixture@0.0.0::src/dep.js",
          canonicalPath: "fixture@0.0.0::src/dep.js",
        },
        sourceOrder: 26,
      }),
    ],
  });
});
