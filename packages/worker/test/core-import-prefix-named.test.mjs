import path from "node:path";
import {
  defaultFilePath,
  pkgRoot,
  prefixFor,
  prefixForSource,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites named imports to the imported module prefix", async () => {
  const result = await transform(
    "import { foo } from './dep.js'; export const value = foo;",
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = ${prefixForSource("./dep.js")}_foo;`,
  );
});

test("uses the imported file's relative path when resolving sibling directories", async () => {
  const filePath = path.posix.join(pkgRoot, "src/pages/index.js");
  const result = await transform(
    "import { foo } from '../shared/dep.js'; export const value = foo;",
    { filePath },
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(filePath)}_value = ${prefixForSource("../shared/dep.js", { fromFilePath: filePath })}_foo;`,
  );
});
