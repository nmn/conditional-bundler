import {
  defaultFilePath,
  prefixFor,
  prefixForSource,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites named re-exports from another module to the imported module prefix", async () => {
  const result = await transform("export { foo as bar } from './dep.js';");

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_bar = ${prefixForSource("./dep.js")}_foo;`,
  );
  expect(result.meta.reexportsNamed).toEqual([
    {
      source: "src/dep.js",
      request: "./dep.js",
      imported: "foo",
      exported: "bar",
    },
  ]);
});

test("rewrites namespace re-exports from another module to the namespace object", async () => {
  const result = await transform("export * as ns from './dep.js';");

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_ns = __NS__${prefixForSource("./dep.js")};`,
  );
  expect(result.meta.reexportsNamed).toEqual([
    {
      source: "src/dep.js",
      request: "./dep.js",
      imported: "*",
      exported: "ns",
      isNamespace: true,
    },
  ]);
  expect(result.meta.exportsLocal).toEqual([
    { local: "ns", exported: "ns", kind: "var" },
  ]);
});

test("records export star metadata without leaving export syntax behind", async () => {
  const result = await transform("export * from './dep.js';");

  expect(trimCode(result)).toBe("");
  expect(result.meta.exportStars).toEqual([
    { source: "src/dep.js", request: "./dep.js" },
  ]);
});
