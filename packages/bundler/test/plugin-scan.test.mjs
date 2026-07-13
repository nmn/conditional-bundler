import { scanModuleRequests } from "../dist/plugins/scan.js";

test("pre-resolves static CommonJS requires", () => {
  expect(
    scanModuleRequests({
      code: `
const direct = require("direct");
function load() {
  return require("nested");
}
function ignored(require) {
  return require("shadowed");
}
`,
      filePath: "/project/module.cjs",
      syntax: { jsx: false, ts: false },
    }),
  ).toEqual([
    { key: "import:direct", kind: "import", request: "direct" },
    { key: "import:nested", kind: "import", request: "nested" },
  ]);
});
