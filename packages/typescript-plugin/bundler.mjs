import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(
  new URL("./transform.mjs", import.meta.url),
);

export default function typescriptBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "typescript-plugin",
    transformPre: [[transformPath, options]],
  };
}
