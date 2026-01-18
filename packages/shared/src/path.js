import path from "node:path";
import fs from "node:fs";
export function normalizePosixPath(filePath) {
    return filePath.split(path.sep).join(path.posix.sep);
}
export function realpathPosix(filePath) {
    const real = fs.realpathSync.native(filePath);
    return normalizePosixPath(real);
}
export function toPosixRelative(fromDir, targetPath) {
    return normalizePosixPath(path.relative(fromDir, targetPath));
}
//# sourceMappingURL=path.js.map