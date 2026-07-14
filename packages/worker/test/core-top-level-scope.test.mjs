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
  const result = await transform("class Thing {} export const value = Thing;");

  expect(trimCode(result)).toBe(
    `class ${prefix}_Thing {}
const ${prefix}_value = ${prefix}_Thing;`,
  );
});

test("preserves object keys when renaming shorthand references", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "const value = 1; const object = { value }; export { object };",
  );

  expect(trimCode(result)).toBe(
    `const ${prefix}_value = 1;
const ${prefix}_object = {
  value: ${prefix}_value
};`,
  );
});

test("renames top-level assignment and update targets", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "export let count = 0; count++; count = count + 1; function reset() { count = 0; }",
  );

  expect(trimCode(result)).toBe(
    `let ${prefix}_count = 0;
${prefix}_count++;
${prefix}_count = ${prefix}_count + 1;
function ${prefix}_reset() {
  ${prefix}_count = 0;
}`,
  );
});

test("preserves destructuring keys while renaming bindings", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "let assigned; const source = { value: 1 }; const { value } = source; ({ value: assigned } = source); export { value, assigned };",
  );

  expect(trimCode(result)).toBe(
    `let ${prefix}_assigned;
const ${prefix}_source = {
  value: 1
};
const {
  value: ${prefix}_value
} = ${prefix}_source;
({
  value: ${prefix}_assigned
} = ${prefix}_source);`,
  );
});
