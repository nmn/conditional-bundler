import fs from "node:fs";
import path from "node:path";
import { normalizePosixPath } from "./path.js";
export function findPkgRoot(startPath) {
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
export function readPkg(pkgRoot) {
    const pkgPath = path.join(pkgRoot, "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const data = JSON.parse(raw);
    return {
        name: data.name ?? "",
        version: data.version ?? "0.0.0",
        root: normalizePosixPath(pkgRoot)
    };
}
export function readPkgSafe(pkgRoot) {
    try {
        return readPkg(pkgRoot);
    }
    catch {
        return {
            name: "",
            version: "0.0.0",
            root: normalizePosixPath(pkgRoot)
        };
    }
}
//# sourceMappingURL=pkg.js.map