import crypto from "node:crypto";
export function hashString(input) {
    return crypto.createHash("sha1").update(input).digest("hex");
}
export function base36Short(hex, length = 8) {
    const value = BigInt(`0x${hex}`);
    return value.toString(36).slice(0, length);
}
export function contentHash(input) {
    return hashString(input);
}
export function contentHashShort(input, length = 8) {
    return base36Short(hashString(input), length);
}
export function filePrefix(pkgName, relPath) {
    const key = `${pkgName}:${relPath}`;
    return base36Short(hashString(key));
}
export function importConstKey(pkgName, relPath) {
    const key = `${pkgName}:${relPath}`;
    return `${base36Short(hashString(key))}__IMPORT`;
}
//# sourceMappingURL=hash.js.map