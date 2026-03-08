import {
  defaultFilePath,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites named default function exports to prefixed bindings", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    "export default function load() { return 1; }",
  );

  expect(trimCode(result)).toBe(
    `const ${prefix}_default = function ${prefix}_load() {
  return 1;
};`,
  );
});

test("rewrites named default class exports to prefixed bindings", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform("export default class Thing {}");

  expect(trimCode(result)).toBe(
    `const ${prefix}_default = class ${prefix}_Thing {};`,
  );
});
