import path from "node:path";
import fs from "node:fs";
import { findPkgRoot, readPkg, normalizePosixPath } from "@bundler/shared";

export type ResolveResult = {
  id: string;
  resolvedPath: string;
  pkg: { name: string; version: string; root: string };
};

export type Resolver = (from: string, source: string, envId: string) => Promise<ResolveResult>;

export function createResolver(): Resolver {
  return async (from: string, source: string) => {
    const resolvedPath = resolvePath(from, source);
    const pkgRoot = findPkgRoot(resolvedPath) ?? path.dirname(resolvedPath);
    const pkg = readPkg(pkgRoot);
    const rel = normalizePosixPath(path.relative(pkg.root, resolvedPath));
    const id = resolvedPath;
    return {
      id,
      resolvedPath,
      pkg
    };
  };
}

function resolvePath(from: string, source: string): string {
  if (source.startsWith(".")) {
    const base = path.dirname(from);
    const candidate = path.resolve(base, source);
    const withExt = resolveWithExtensions(candidate);
    return withExt;
  }
  return requireResolve(source, path.dirname(from));
}

function resolveWithExtensions(filePath: string): string {
  const extensions = [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs"];
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  for (const ext of extensions) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  if (fs.existsSync(path.join(filePath, "index.js"))) {
    return path.join(filePath, "index.js");
  }
  throw new Error(`Cannot resolve '${filePath}'`);
}

function requireResolve(source: string, fromDir: string): string {
  return require.resolve(source, { paths: [fromDir] });
}
