import {
  defaultFilePath,
  prefixFor,
  prefixForSource,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites default imports to the imported module's default binding", async () => {
  const result = await transform(
    "import foo from './dep.js'; export const value = foo;",
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = ${prefixForSource("./dep.js")}_default;`,
  );
});

test("defines conditional imports as local prefixed bindings wrapped in markers", async () => {
  const result = await transform(
    "import { foo } from './dep.js' with { condition: 'COND_A' }; export const value = foo;",
  );

  expect(trimCode(result)).toBe(
    `/////##CONDITION_START##"COND_A"
const ${prefixFor(defaultFilePath)}_foo = ${prefixForSource("./dep.js")}_foo;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const ${prefixFor(defaultFilePath)}_foo = undefined;
/////##CONDITION_END##
const ${prefixFor(defaultFilePath)}_value = ${prefixFor(defaultFilePath)}_foo;`,
  );
});
