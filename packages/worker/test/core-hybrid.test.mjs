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
  }).toEqual({
    code: `/////##CONDITION_START##"COND_A"
const ji19ybwd_pick = rzh0ycy4_pick;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const ji19ybwd_pick = gb2g3nny_pick;
/////##CONDITION_END##
const ji19ybwd_default = async function ji19ybwd_run(key) {
  const mod = await __IMPORT_a38syydlx();
  return a4tfu7r6i_default + a4tfu7r6i_foo + __NS__aykq3vp9[key] + ji19ybwd_pick + mod.value;
};`,
    meta: {
      conditionalImports: [
        {
          condition: "COND_A",
          elseRequest: "./fallback.js",
          elseSource: "src/fallback.js",
          request: "./feature.js",
          source: "src/feature.js",
        },
      ],
      discoveredEntrypoints: ["src/lazy.js"],
      dynamicImports: [
        {
          hashKey: "__IMPORT_a38syydlx",
          request: "./lazy.js",
          source: "src/lazy.js",
        },
      ],
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
        {
          attributes: undefined,
          condition: undefined,
          isDefault: true,
          isNamespace: false,
          kind: "value",
          request: "./dep.js",
          source: "src/dep.js",
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
        },
        {
          attributes: undefined,
          condition: undefined,
          isDefault: false,
          isNamespace: true,
          kind: "value",
          namespaceUsage: "dynamic",
          request: "./ns.js",
          source: "src/ns.js",
          specifiers: [
            {
              imported: "*",
              local: "ns",
              useRanges: [],
            },
          ],
        },
        {
          attributes: undefined,
          condition: "COND_A",
          isDefault: false,
          isNamespace: false,
          kind: "value",
          request: "./feature.js",
          source: "src/feature.js",
          specifiers: [
            {
              imported: "pick",
              local: "pick",
              useRanges: [],
            },
          ],
        },
      ],
      reexportsNamed: [
        {
          exported: "renamedHelper",
          imported: "helper",
          request: "./helpers.js",
          source: "src/helpers.js",
          sourceOrder: 183,
        },
      ],
    },
  });
});
