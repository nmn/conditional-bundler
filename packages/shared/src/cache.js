import fs from "node:fs/promises";
import path from "node:path";
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}
export async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}
export async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
//# sourceMappingURL=cache.js.map
