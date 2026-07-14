import path from "node:path";
import { fileURLToPath } from "node:url";
import { filePrefix } from "../../shared/src/hash.js";
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

test("uses the package-relative path for CJS virtual module prefixes", async () => {
  const relativePath = "cjs/react-dom-client.production.js";
  const firstRoot = "/Users/first/project/node_modules/react-dom";
  const secondRoot = "/home/second/project/node_modules/react-dom";
  const makeId = (filePath) =>
    `virtual:cjs-to-esm:client:production:${Buffer.from(filePath).toString("base64url")}`;
  const code = "export const value = 1;";

  const first = await transform(code, {
    id: makeId(path.posix.join(firstRoot, relativePath)),
    filePath: path.posix.join(firstRoot, relativePath),
    root: firstRoot,
  });
  const second = await transform(code, {
    id: makeId(path.posix.join(secondRoot, relativePath)),
    filePath: path.posix.join(secondRoot, relativePath),
    root: secondRoot,
  });
  const expectedPrefix = filePrefix("fixture", "0.0.0", relativePath);

  expect(trimCode(first)).toBe(`const ${expectedPrefix}_value = 1;`);
  expect(trimCode(second)).toBe(trimCode(first));
});

test("uses dependency package identity for imports from CJS virtual modules", async () => {
  const dependencyRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../shared",
  );
  const dependencyPath = path.join(dependencyRoot, "src/hash.js");
  const dependencyId = `virtual:cjs-to-esm:client:production:${Buffer.from(dependencyPath).toString("base64url")}`;
  const dependencyPrefix = filePrefix(
    "@bundler/shared",
    "0.1.0",
    "src/hash.js",
  );
  const result = await transform(
    'import { version } from "react-dom/client"; export const value = version;',
    {
      resolvedImports: {
        "import:react-dom/client": {
          id: dependencyId,
          filePath: dependencyPath,
          external: false,
        },
      },
    },
  );

  expect(trimCode(result)).toBe(
    `const ${prefixFor(defaultFilePath)}_value = ${dependencyPrefix}_version;`,
  );
});
