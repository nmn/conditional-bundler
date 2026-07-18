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
