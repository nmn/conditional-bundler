import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));

export default function importAttributesBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "import-attributes",
    transformFinalize: [[transformPath, options]],
  };
}
