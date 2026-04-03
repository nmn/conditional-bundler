import {
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites named re-exports from another module to the imported module prefix", async () => {
  const result = await transform("export { foo as bar } from './dep.js';");

  expect(trimCode(result)).toBe("");
  expect(result.meta.reexportsNamed).toEqual([
    {
      source: "src/dep.js",
      request: "./dep.js",
      imported: "foo",
      exported: "bar",
      sourceOrder: 0,
    },
  ]);
});

test("rewrites namespace re-exports from another module to the namespace object", async () => {
  const result = await transform("export * as ns from './dep.js';");

  expect(trimCode(result)).toBe("");
  expect(result.meta.reexportsNamed).toEqual([
    {
      source: "src/dep.js",
      request: "./dep.js",
      imported: "*",
      exported: "ns",
      isNamespace: true,
      sourceOrder: 0,
    },
  ]);
  expect(result.meta.exportsLocal).toEqual([]);
});

test("records export star metadata without leaving export syntax behind", async () => {
  const result = await transform("export * from './dep.js';");

  expect(trimCode(result)).toBe("");
  expect(result.meta.exportStars).toEqual([
    { source: "src/dep.js", request: "./dep.js", sourceOrder: 0 },
  ]);
});
