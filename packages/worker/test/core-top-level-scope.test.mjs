import {
  defaultFilePath,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("renames top-level bindings but leaves nested bindings alone", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "const outer = 1; function wrap(value) { const local = outer + value; return local; }",
  );

  expect(trimCode(result)).toBe(
    `const ${prefix}_outer = 1;
function ${prefix}_wrap(value) {
  const local = ${prefix}_outer + value;
  return local;
}`,
  );
});

test("renames top-level class bindings and their references", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "class Thing {} export const value = Thing;",
  );

  expect(trimCode(result)).toBe(
    `class ${prefix}_Thing {}
const ${prefix}_value = ${prefix}_Thing;`,
  );
});
