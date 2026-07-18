import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));

export default function queryImportsBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "query-imports",
    transformFinalize: [[transformPath, options]],
  };
}
