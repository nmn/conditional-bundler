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
    id,
    resolvedImports,
    dev,
  } = {},
) {
  const { scanImportRequests, transformWithCore } =
    await import("../../dist/transform/core.js");
  const moduleIdentity = canonicalIdentity(filePath, root);
  const input = {
    code,
    id,
    moduleIdentity,
    canonicalPath: moduleIdentity,
    realPath: filePath,
    pkg: { name: pkgName, version: pkgVersion, root },
    syntax,
    envs: ["browser"],
    dev,
  };
  return transformWithCore(
    {
      ...input,
      resolvedImports: {
        ...defaultResolvedImports(scanImportRequests(input), filePath, root),
        ...resolvedImports,
      },
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

function canonicalIdentity(filePath, root) {
  return `${pkgName}@${pkgVersion}::${path.posix.relative(root, filePath)}`;
}

function defaultResolvedImports(requests, filePath, root) {
  return Object.fromEntries(
    requests.map(({ key, request }) => {
      const relativePath = request.startsWith(".")
        ? path.posix.relative(
            root,
            path.posix.resolve(path.posix.dirname(filePath), request),
          )
        : request;
      const canonicalPath = `${pkgName}@${pkgVersion}::${relativePath}`;
      return [
        key,
        {
          target: { kind: "file", moduleId: canonicalPath, canonicalPath },
          type: "javascript",
          intent: "module",
        },
      ];
    }),
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
