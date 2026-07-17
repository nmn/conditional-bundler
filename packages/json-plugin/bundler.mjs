import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(
  new URL("./transform.mjs", import.meta.url),
);

export default function jsonBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "json-plugin",
    transformPre: [[transformPath, options]],
  };
}
