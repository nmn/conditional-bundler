import fs from "node:fs/promises";
import path from "node:path";

export type CachePaths = {
  codePath: string;
  mapPath?: string;
  irPath: string;
};

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function readFileIfExists(
  filePath: string,
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
