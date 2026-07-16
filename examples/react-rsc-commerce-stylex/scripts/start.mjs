import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const manifestPath = path.join(root, "dist", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Build the example before starting it: pnpm build");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const serverBundle = manifest.bundles.find(
  (bundle) => bundle.envId === "rsc" && bundle.entryId.endsWith("server.jsx"),
);

if (!serverBundle) {
  throw new Error("Missing StyleX RSC server bundle.");
}

await import(pathToFileURL(path.join(root, "dist", serverBundle.fileName)));
