import crypto from "node:crypto";

export function hashString(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function base36Short(hex: string, length = 8): string {
  const value = BigInt(`0x${hex}`);
  return value.toString(36).slice(0, length);
}

export function contentHash(input: string): string {
  return hashString(input);
}

export function filePrefix(pkgName: string, relPath: string): string {
  const key = `${pkgName}:${relPath}`;
  return base36Short(hashString(key));
}

export function importConstKey(pkgName: string, relPath: string): string {
  const key = `${pkgName}:${relPath}`;
  return `${base36Short(hashString(key))}__IMPORT`;
}
