import { fileURLToPath } from "node:url";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));

export default function modulePathsBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "module-paths",
    transform: [
      [
        transformPath,
        {
          ...options,
          __bundlerEnvironmentIndependentUnlessModulePaths: true,
        },
      ],
    ],
  };
}
