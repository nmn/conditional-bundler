import path from "node:path";
import { fileURLToPath } from "node:url";
import { plugin } from "@bundler/bundler";

const root = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.BUNDLER_MODE === "development";

export default {
  envs: {
    server: {
      target: "node",
      conditions: ["node"],
    },
    client: {
      target: "browser",
      conditions: ["browser"],
    },
  },
  entries: [
    { id: "server", path: path.join(root, "src/server.server.jsx") },
    { id: "client", path: path.join(root, "src/client.client.jsx") },
  ],
  outputs: {
    outDir: path.join(root, "dist"),
    fileName: "[entry].[env].[hash].js",
    manifestFile: "manifest.json",
    sourceMap: "external",
  },
  plugins: [
    plugin("@bundler/react-jsx-plugin", { runtime: "classic" }),
    plugin("@bundler/stylex-plugin", {
      rootDir: root,
      dev: isDev,
    }),
    plugin("@bundler/cjs-to-esm/bundler"),
  ],
  cacheDir: path.join(root, ".cache/conditional-bundler"),
  maxWorkers: 4,
  diagnostics: "human",
  dev: isDev
    ? {
        hmr: true,
        reactRefresh: true,
        fullReloadOnFailure: true,
        port: Number(process.env.PORT ?? 3500),
      }
    : undefined,
};
