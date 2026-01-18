import path from "node:path";
import fs from "node:fs";

export function normalizePosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

export function realpathPosix(filePath: string): string {
  const real = fs.realpathSync.native(filePath);
  return normalizePosixPath(real);
}

export function toPosixRelative(fromDir: string, targetPath: string): string {
  return normalizePosixPath(path.relative(fromDir, targetPath));
}
