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

test("preserves native dynamic imports after pre-core normalization", async () => {
  const result = await transformSnapshot(
    "export async function load() { return import('./dep.js'); }",
  );
  expect(result.code).toBe(
    `async function ji19ybwd_load() {\n  return import('./dep.js');\n}`,
  );
  expect(result.meta).toMatchObject({
    conditionalImports: [],
    discoveredEntrypoints: [],
    exportsLocal: [{ exported: "load", kind: "func", local: "load" }],
    imports: [],
    reexportsNamed: [],
  });
});

test("rejects top-level await", async () => {
  await expect(transform("await Promise.resolve(1);")).rejects.toThrow("E_TLA");
});
