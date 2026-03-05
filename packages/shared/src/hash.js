import crypto from "node:crypto";
export function hashString(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}
export function base36Short(hex, length = 8) {
  const value = BigInt(`0x${hex}`);
  return value.toString(36).slice(0, length);
}
export function base36ShortAlpha(hex, length = 8) {
  const raw = base36Short(hex, length);
  if (raw.length === 0) {
    return "a";
  }
  if (/^[0-9]/.test(raw)) {
    return `a${raw}`.slice(0, length + 1);
  }
  return raw;
}
export function contentHash(input) {
  return hashString(input);
}
export function contentHashShort(input, length = 8) {
  return base36Short(hashString(input), length);
}
export function filePrefix(pkgName, pkgVersion, relPath) {
  const key = `${pkgName}@${pkgVersion}:${relPath}`;
  return base36ShortAlpha(hashString(key));
}
export function importConstKey(pkgName, pkgVersion, relPath) {
  const key = `${pkgName}@${pkgVersion}:${relPath}`;
  return base36ShortAlpha(hashString(key));
}
//# sourceMappingURL=hash.js.map
