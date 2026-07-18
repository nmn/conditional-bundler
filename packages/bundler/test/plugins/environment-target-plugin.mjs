import { fileURLToPath } from "node:url";

const transform = fileURLToPath(
  new URL("./environment-target-babel.mjs", import.meta.url),
);

export default function environmentTargetPlugin(options = {}) {
  return {
    name: "environment-target-test",
    representations: {
      "test-url": {
        extends: "url",
      },
    },
    transform: [
      {
        plugin: transform,
        environments: [options.environment ?? "app"],
      },
    ],
  };
}
