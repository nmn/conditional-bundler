import { transformAsync } from "@babel/core";
import modulePaths from "../index.mjs";

async function transform(code, options = {}) {
  return transformAsync(code, {
    sourceType: "module",
    plugins: [
      [
        modulePaths,
        {
          moduleIdentity: "example@1.0.0::src/index.js",
          target: "node",
          ...options,
        },
      ],
    ],
  });
}

test("replaces path globals and known import.meta properties with references", async () => {
  const result = await transform(
    "export const paths = [__dirname, __filename, import.meta.url, import.meta.dirname, import.meta.filename];",
  );
  expect(result.code).not.toContain("example@1.0.0");
  expect(result.metadata.conditionalBundlerLinkReferences).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "module-url" }),
      expect.objectContaining({ kind: "module-filename" }),
      expect.objectContaining({ kind: "module-dirname" }),
    ]),
  );
});

test("preserves shadowed globals and import.meta.hot", async () => {
  const result = await transform(
    "function read(__dirname) { return [__dirname, import.meta.hot]; }",
  );
  expect(result.code).toContain("__dirname");
  expect(result.code).toContain("import.meta.hot");
  expect(result.metadata.conditionalBundlerLinkReferences).toBeUndefined();
});

test("rejects filesystem path properties for browser targets", async () => {
  await expect(
    transform("console.log(__dirname);", { target: "browser" }),
  ).rejects.toThrow("only available in Node-target bundles");
});
