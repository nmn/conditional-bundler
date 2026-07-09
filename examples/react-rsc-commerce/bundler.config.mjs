import path from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "@bundler/bundler";

const root = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.BUNDLER_MODE === "development";

export default {
  envs: {
    rsc: {
      target: "node",
      conditions: ["react-server", "node", ...(isDev ? ["__DEV__"] : [])],
    },
    client: {
      target: "browser",
      conditions: ["browser", ...(isDev ? ["__DEV__"] : [])],
    },
  },
  entries: [
    {
      id: "server",
      path: path.join(root, "src/server.jsx"),
      envs: ["rsc"],
    },
  ],
  outputs: {
    outDir: path.join(root, "dist"),
    fileName: "[entry].[env].[hash].js",
    manifestFile: "manifest.json",
  },
  plugins: [
    plugin("../shared/rsc-plugin/rsc-example-plugin.mjs", {
      root,
      name: "react-rsc-commerce",
      jsx: "classic",
      clientEntry: false,
      runtimeEntry: true,
    }),
  ],
  cacheDir: path.join(root, ".cache/conditional-bundler"),
  maxWorkers: 2,
  diagnostics: "human",
  dev: isDev
    ? {
        hmr: true,
        reactRefresh: true,
        fullReloadOnFailure: true,
        port: 3200,
      }
    : undefined,
};
