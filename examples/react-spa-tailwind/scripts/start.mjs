import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "dist/manifest.json"), "utf8"),
);
const serverBundle = manifest.bundles.find(
  (bundle) =>
    bundle.targetIds.includes("server") &&
    bundle.environmentIds.includes("javascript") &&
    bundle.entryId.endsWith("server.server.jsx"),
);

if (!serverBundle) throw new Error("Missing Tailwind SPA server bundle.");

await import(pathToFileURL(path.join(root, "dist", serverBundle.fileName)));
