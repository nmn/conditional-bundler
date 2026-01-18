import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveWorkerPath(): string {
  return fileURLToPath(new URL("../../worker/dist/worker.js", import.meta.url));
}
