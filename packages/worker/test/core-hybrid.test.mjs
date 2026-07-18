import path from "node:path";

const pkgRoot = "/fixture";
const defaultFilePath = path.posix.join(pkgRoot, "src/index.js");

const fileTarget = (relativePath) => ({
  kind: "file",
  moduleId: `fixture@0.0.0::${relativePath}`,
  canonicalPath: `fixture@0.0.0::${relativePath}`,
});

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

test("handles a mixed module with reexports, conditional imports, namespace access, and dynamic import", async () => {
  const result = await transform(`
    import thing, { foo as bar } from "./dep.js";
    import * as ns from "./ns.js";
    import { pick } from "./feature.js" with { condition: "COND_A", else: "./fallback.js" };
    export { helper as renamedHelper } from "./helpers.js";
    export default async function run(key) {
      const mod = await import("./lazy.js");
      return thing + bar + ns[key] + pick + mod.value;
    }
  `);

  expect({
    code: result.code,
    meta: result.meta,
  }).toMatchObject({
    code: `let ji19ybwd_pick;
/////##CONDITION_START##"COND_A"
ji19ybwd_pick = rzh0ycy4_pick;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
ji19ybwd_pick = gb2g3nny_pick;
/////##CONDITION_END##
const ji19ybwd_default = async function ji19ybwd_run(key) {
  const mod = await import("./lazy.js");
  return a4tfu7r6i_default + a4tfu7r6i_foo + __NS__aykq3vp9[key] + ji19ybwd_pick + mod.value;
};`,
    meta: {
      conditionalImports: [
        expect.objectContaining({
          condition: "COND_A",
          elseRequest: "./fallback.js",
          elseSource: "src/fallback.js",
          elseTarget: fileTarget("src/fallback.js"),
          request: "./feature.js",
          source: "src/feature.js",
          target: fileTarget("src/feature.js"),
        }),
      ],
      discoveredEntrypoints: [],
      exportRanges: [],
      exportStars: [],
      exportsLocal: [
        {
          exported: "default",
          kind: "default",
          local: "default",
        },
      ],
      flags: {
        hasTopLevelAwait: false,
        needsNamespaceObject: true,
        sideEffects: true,
      },
      importRanges: [],
      imports: [
        expect.objectContaining({
          attributes: undefined,
          condition: undefined,
          isDefault: true,
          isNamespace: false,
          kind: "value",
          request: "./dep.js",
          source: "src/dep.js",
          target: fileTarget("src/dep.js"),
          specifiers: [
            {
              imported: "default",
              local: "thing",
              useRanges: [],
            },
            {
              imported: "foo",
              local: "bar",
              useRanges: [],
            },
          ],
        }),
        expect.objectContaining({
          attributes: undefined,
          condition: undefined,
          isDefault: false,
          isNamespace: true,
          kind: "value",
          namespaceUsage: "dynamic",
          request: "./ns.js",
          source: "src/ns.js",
          target: fileTarget("src/ns.js"),
          specifiers: [
            {
              imported: "*",
              local: "ns",
              useRanges: [],
            },
          ],
        }),
        expect.objectContaining({
          attributes: {
            condition: "COND_A",
            else: "./fallback.js",
          },
          condition: "COND_A",
          isDefault: false,
          isNamespace: false,
          kind: "value",
          request: "./feature.js",
          source: "src/feature.js",
          target: fileTarget("src/feature.js"),
          specifiers: [
            {
              imported: "pick",
              local: "pick",
              useRanges: [],
            },
          ],
        }),
      ],
      reexportsNamed: [
        expect.objectContaining({
          exported: "renamedHelper",
          imported: "helper",
          request: "./helpers.js",
          source: "src/helpers.js",
          target: fileTarget("src/helpers.js"),
          sourceOrder: 183,
        }),
      ],
    },
  });
});
