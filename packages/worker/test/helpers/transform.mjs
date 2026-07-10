import path from "node:path";
import { filePrefix } from "../../../shared/src/hash.js";

export const pkgName = "fixture";
export const pkgVersion = "0.0.0";
export const pkgRoot = "/fixture";
export const defaultFilePath = path.posix.join(pkgRoot, "src/index.js");

export async function transform(
  code,
  {
    filePath = defaultFilePath,
    root = pkgRoot,
    syntax = { jsx: false, ts: false },
    sourceMap = false,
    dev,
  } = {},
) {
  const { transformWithCore } = await import("../../dist/transform/core.js");
  return transformWithCore(
    {
      code,
      realPath: filePath,
      pkg: { name: pkgName, version: pkgVersion, root },
      syntax,
      envs: ["browser"],
      dev,
    },
    {
      importAttrAllow: ["json"],
      sourceMap: sourceMap
        ? {
            sourceFileName: filePath,
            sourcesContent: true,
          }
        : undefined,
    },
  );
}

export function prefixFor(filePath, root = pkgRoot) {
  const relPath = path.posix.relative(root, filePath);
  return filePrefix(pkgName, pkgVersion, relPath);
}

export function prefixForSource(
  source,
  { fromFilePath = defaultFilePath, root = pkgRoot } = {},
) {
  if (!source.startsWith(".")) {
    return filePrefix(pkgName, pkgVersion, source);
  }
  const resolvedPath = path.posix.resolve(
    path.posix.dirname(fromFilePath),
    source,
  );
  return prefixFor(resolvedPath, root);
}

export function trimCode(result) {
  return result.code.trim();
}
