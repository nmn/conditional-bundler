import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "dist/manifest.json"), "utf8"),
);
const serverBundle = manifest.bundles.find(
  (bundle) => bundle.envId === "rsc" && bundle.entryId.endsWith("server.jsx"),
);

if (!serverBundle) {
  throw new Error("Build the example before running it.");
}

await import(pathToFileURL(path.join(root, "dist", serverBundle.fileName)));
