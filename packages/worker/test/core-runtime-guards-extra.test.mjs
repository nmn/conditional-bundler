import {
  defaultFilePath,
  prefixFor,
  transform,
  trimCode,
} from "./helpers/transform.mjs";

test("rewrites import.meta.url URL construction with the current file prefix", async () => {
  const result = await transform(
    "const href = new URL('./asset.png', import.meta.url);",
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_href = __BUNDLER_URL__("${prefixFor(defaultFilePath)}", "./asset.png");`,
  );
});

test("rejects assignment to named imports", async () => {
  await expect(
    transform("import { foo } from './dep.js'; foo = 1;"),
  ).rejects.toThrow("E_IMPORT_ASSIGN");
});

test("rejects update expressions on named imports", async () => {
  await expect(
    transform("import { foo } from './dep.js'; foo++;"),
  ).rejects.toThrow("E_IMPORT_ASSIGN");
});
