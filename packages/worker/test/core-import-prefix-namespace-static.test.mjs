import {
  defaultFilePath,
  prefixFor,
  prefixForSource,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites static namespace property access to individual imported bindings", async () => {
  const result = await transform(
    "import * as ns from './dep.js'; export const value = ns.foo + ns.bar;",
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = ${prefixForSource("./dep.js")}_foo + ${prefixForSource("./dep.js")}_bar;`,
  );
  expect(result.meta.flags.needsNamespaceObject).toBe(false);
  expect(result.meta.imports[0]).toMatchObject({
    source: "src/dep.js",
    request: "./dep.js",
    isNamespace: true,
    namespaceUsage: "static",
    specifiers: [
      { imported: "foo", local: "ns", useRanges: [] },
      { imported: "bar", local: "ns", useRanges: [] },
    ],
  });
});
