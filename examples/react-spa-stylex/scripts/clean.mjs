import fs from "node:fs/promises";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));

await fs.rm(path.join(root, "dist"), { recursive: true, force: true });
