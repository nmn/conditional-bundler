import fs from "node:fs";
import path from "node:path";
import { normalizePosixPath } from "./path.js";

export type PackageInfo = {
  name: string;
  version: string;
  root: string;
};

export function findPkgRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  while (true) {
    const pkgPath = path.join(current, "package.json");
    if (fs.existsSync(pkgPath)) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) {
      return null;
    }
    current = next;
  }
}

export function readPkg(pkgRoot: string): PackageInfo {
  const pkgPath = path.join(pkgRoot, "package.json");
  const raw = fs.readFileSync(pkgPath, "utf8");
  const data = JSON.parse(raw) as { name?: string; version?: string };
  return {
    name: data.name ?? "",
    version: data.version ?? "0.0.0",
    root: normalizePosixPath(pkgRoot)
  };
}

export function readPkgSafe(pkgRoot: string): PackageInfo {
  try {
    return readPkg(pkgRoot);
  } catch {
    return {
      name: "",
      version: "0.0.0",
      root: normalizePosixPath(pkgRoot)
    };
  }
}
