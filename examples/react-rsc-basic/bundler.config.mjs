import path from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "@bundler/bundler";

const root = path.dirname(fileURLToPath(import.meta.url));

export default {
  envs: {
    rsc: { target: "node", conditions: ["react-server", "node"] },
    client: { target: "browser", conditions: ["browser"] },
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
      name: "react-rsc-basic",
    }),
  ],
  cacheDir: path.join(root, ".cache/conditional-bundler"),
  maxWorkers: 2,
  diagnostics: "human",
};
