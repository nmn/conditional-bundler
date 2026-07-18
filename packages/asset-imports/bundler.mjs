import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));

export default function assetImportsBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "asset-imports",
    transformFinalize: [[transformPath, options]],
  };
}
