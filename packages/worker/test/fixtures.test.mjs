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
