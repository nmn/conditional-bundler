import { createRequire } from "node:module";

const requireFromPlugin = createRequire(import.meta.url);

export default function reactJsxPlugin(options = {}) {
  const runtime = options.runtime ?? "classic";
  return {
    name: options.name ?? "react-jsx-plugin",
    transform: [
      [
        requireFromPlugin.resolve("@babel/plugin-transform-react-jsx"),
        {
          runtime,
          ...(runtime === "automatic"
            ? { importSource: options.importSource ?? "react" }
            : {}),
          __bundlerExcludeNodeModules: true,
          __bundlerEnvironmentIndependent: true,
        },
      ],
    ],
  };
}
