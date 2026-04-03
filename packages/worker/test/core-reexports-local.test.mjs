import {
  defaultFilePath,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("creates a prefixed alias for renamed local re-exports", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform("const local = 1; export { local as renamed };");

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
