import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));

export default function dynamicImportsBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "dynamic-imports",
    transformFinalize: [[transformPath, options]],
  };
}
