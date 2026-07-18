import { createRequire } from "node:module";
import queryImports from "../index.mjs";

const requireFromPeer = createRequire(
  new URL("../../static-assets/package.json", import.meta.url),
);
const { transformAsync } = requireFromPeer("@babel/core");

async function transform(code) {
  return transformAsync(code, {
    sourceType: "module",
    parserOpts: { plugins: ["importAttributes"] },
    plugins: [queryImports],
  });
}

test.each([
  ["?url", "url"],
  ["?worker&url", "url"],
  ["?raw", "raw"],
  ["?base64", "base64"],
])("normalizes %s to an as attribute", async (query, representation) => {
  const result = await transform(`import value from "./resource${query}";`);
  expect(result.code).toBe(
    `import value from "./resource" with { as: "${representation}" };`,
  );
});

test("rejects conflicting and malformed representation queries", async () => {
  await expect(
    transform('import value from "./resource?url" with { as: "raw" };'),
  ).rejects.toThrow("E_IMPORT_REPRESENTATION_CONFLICT");
  await expect(
    transform('import value from "./resource?worker&raw";'),
  ).rejects.toThrow("E_IMPORT_QUERY");
});
