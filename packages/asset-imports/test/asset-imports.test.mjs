import { createRequire } from "node:module";
import assetImports from "../index.mjs";

const requireFromPeer = createRequire(
  new URL("../../static-assets/package.json", import.meta.url),
);
const { transformAsync } = requireFromPeer("@babel/core");

async function transform(code, options) {
  return transformAsync(code, {
    sourceType: "module",
    plugins: [[assetImports, options]],
  });
}

test("defaults images to sized references and other assets to URLs", async () => {
  const result = await transform(
    'import image from "./image.png"; import font from "./font.woff2";',
  );
  expect(result.code).toContain(
    'from "./image.png" with { as: "image-reference-with-size" }',
  );
  expect(result.code).toContain('from "./font.woff2" with { as: "url" }');
});

test("configures or disables implicit bare-image representations", async () => {
  const url = await transform('import image from "./image.png";', {
    imageRepresentation: "url",
  });
  expect(url.code).toContain('with { as: "url" }');

  const custom = await transform('import image from "./image.png";', {
    imageRepresentation: "sprite-url",
  });
  expect(custom.code).toContain('with { as: "sprite-url" }');

  const disabled = await transform('import image from "./image.png";', {
    imageRepresentation: false,
  });
  expect(disabled.code).toBe('import image from "./image.png";');
});
