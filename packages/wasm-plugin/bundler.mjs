import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(
  new URL("./transform.mjs", import.meta.url),
);

export default function wasmBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "wasm-plugin",
    representations: {
      wasm: {
        extends: "url",
        workerTransform: [transformPath, options],
      },
    },
  };
}
