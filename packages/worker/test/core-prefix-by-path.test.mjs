import path from "node:path";
import {
  defaultFilePath,
  pkgRoot,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("derives the top-level prefix from the file's relative path", async () => {
  const filePath = path.posix.join(pkgRoot, "src/nested/index.js");
  const result = await transform("export const value = 1;", { filePath });

  expect(trimCode(result)).toBe(`const ${prefixFor(filePath)}_value = 1;`);
});

test("changes the prefix when the module path changes", async () => {
  const otherFilePath = path.posix.join(pkgRoot, "src/other.js");

  const first = await transform("export const value = 1;");
  const second = await transform("export const value = 1;", {
    filePath: otherFilePath,
  });

  expect(trimCode(first)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = 1;`,
  );
  expect(trimCode(second)).toBe(`const ${prefixFor(otherFilePath)}_value = 1;`);
  expect(trimCode(first)).not.toBe(trimCode(second));
});
