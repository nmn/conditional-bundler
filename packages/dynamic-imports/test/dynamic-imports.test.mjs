import { createRequire } from "node:module";
import dynamicImports from "../index.mjs";

const requireFromPeer = createRequire(
  new URL("../../static-assets/package.json", import.meta.url),
);
const { transformAsync } = requireFromPeer("@babel/core");

test("deduplicates literal local dynamic imports through one dependency URL array", async () => {
  const result = await transformAsync(
    'const first = import("./feature.js"); const second = import("./feature.js");',
    { sourceType: "module", plugins: [dynamicImports] },
  );
  expect(
    result.code.match(/with \{ as: "url_and_deps_array" \}/g),
  ).toHaveLength(1);
  expect(
    result.code.match(/Promise\.all\(_bundler_dynamic_urls\.map/g),
  ).toHaveLength(1);
  expect(result.code.match(/_bundler_dynamic_import\(\)/g)).toHaveLength(2);
  expect(result.code).not.toContain("function _bundler_dynamic_namespace(");
  expect(result.code).toContain("_bundler_dynamic_urls.__bundlerModulePrefix");
  expect(result.code).toContain(
    '_bundler_dynamic_modules[0]["__NS__" + _bundler_dynamic_urls.__bundlerModulePrefix]',
  );
});

test("preserves nonliteral and runtime dynamic imports", async () => {
  const result = await transformAsync(
    'const local = import(name); const runtime = import("node:fs");',
    { sourceType: "module", plugins: [dynamicImports] },
  );
  expect(result.code).toContain("import(name)");
  expect(result.code).toContain('import("node:fs")');
  expect(result.code).not.toContain('with { as: "url_and_deps_array" }');
});
