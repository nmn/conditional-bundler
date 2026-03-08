import {
  defaultFilePath,
  prefixFor,
  prefixForSource,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites dynamic namespace access to the namespace object prefix", async () => {
  const result = await transform(
    "import * as ns from './dep.js'; export const value = ns[key];",
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = __NS__${prefixForSource("./dep.js")}[key];`,
  );
  expect(result.meta.flags.needsNamespaceObject).toBe(true);
  expect(result.meta.imports[0]).toMatchObject({
    source: "src/dep.js",
    request: "./dep.js",
    isNamespace: true,
    namespaceUsage: "dynamic",
    specifiers: [{ imported: "*", local: "ns", useRanges: [] }],
  });
});
