import path from "node:path";
import { fileURLToPath } from "node:url";

const workerTransform = fileURLToPath(
  new URL("./representation-worker.mjs", import.meta.url),
);

export default function representationPlugin(options = {}) {
  return {
    name: "test-representation",
    representations: {
      "test-uppercase": {
        async resolve(context) {
          const resolved = await context.resolveDefault();
          if ("preserve" in resolved) return resolved;
          return {
            ...resolved,
            filePath: path.resolve(resolved.filePath),
            type: "asset",
          };
        },
        workerTransform: [workerTransform, { suffix: "!", mode: options.mode }],
      },
    },
  };
}
