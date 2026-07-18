import { createRequire } from "node:module";
import importAttributes from "../index.mjs";

const requireFromPeer = createRequire(
  new URL("../../static-assets/package.json", import.meta.url),
);
const { transformAsync } = requireFromPeer("@babel/core");

test("moves legacy representation types to as and preserves source types", async () => {
  const result = await transformAsync(
    'import raw from "./text.txt" with { type: "raw" }; import data from "./data.json" with { type: "json" };',
    {
      sourceType: "module",
      parserOpts: { plugins: ["importAttributes"] },
      plugins: [importAttributes],
    },
  );
  expect(result.code).toContain(
    'import raw from "./text.txt" with { as: "raw" };',
  );
  expect(result.code).toContain(
    'import data from "./data.json" with { type: "json" };',
  );
});
