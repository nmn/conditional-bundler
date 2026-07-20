import {
  defaultFilePath,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("creates a prefixed alias for renamed local re-exports", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "const local = 1; export { local as renamed };",
  );

  expect(trimCode(result)).toBe(
    `const ${prefix}_local = 1;
const ${prefix}_renamed = ${prefix}_local;`,
  );
  expect(result.meta.exportsLocal).toEqual([
    { local: "renamed", exported: "renamed", kind: "var" },
  ]);
});

test("removes direct local export statements after recording metadata", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform("const local = 1; export { local };");

  expect(trimCode(result)).toBe(`const ${prefix}_local = 1;`);
  expect(result.meta.exportsLocal).toEqual([
    { local: "local", exported: "local", kind: "var" },
  ]);
});

test("records an imported binding exported under the same name as a re-export", async () => {
  const result = await transform(
    `import { value } from "./dep.js"; export { value };`,
  );

  expect(trimCode(result)).toBe("");
  expect(result.meta.exportsLocal).toEqual([]);
  expect(result.meta.reexportsNamed).toEqual([
    expect.objectContaining({
      source: "src/dep.js",
      request: "./dep.js",
      imported: "value",
      exported: "value",
      target: {
        kind: "file",
        moduleId: "fixture@0.0.0::src/dep.js",
        canonicalPath: "fixture@0.0.0::src/dep.js",
      },
    }),
  ]);
});

test("preserves imported and exported names for indirect re-exports", async () => {
  const result = await transform(
    `import { value as local } from "./dep.js"; export { local as renamed };`,
  );

  expect(trimCode(result)).toBe("");
  expect(result.meta.exportsLocal).toEqual([]);
  expect(result.meta.reexportsNamed).toEqual([
    expect.objectContaining({
      imported: "value",
      exported: "renamed",
    }),
  ]);
});
