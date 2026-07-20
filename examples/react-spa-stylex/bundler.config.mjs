import path from "node:path";
import { fileURLToPath } from "node:url";
import { plugin, resolver } from "@bundler/bundler";

const root = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.BUNDLER_MODE === "development";

export default {
  targets: {
    server: {
      platform: "node",
      packageResolver: resolver("@bundler/node-package-resolver"),
    },
    client: {
      platform: "browser",
      packageResolver: resolver("@bundler/browser-package-resolver"),
    },
  },
  environments: { javascript: {} },
  environmentVariables: {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  },
  entries: [
    {
      path: path.join(root, "src/server.server.jsx"),
      environment: "javascript",
      targets: ["server"],
    },
    {
      path: path.join(root, "src/client.client.jsx"),
      environment: "javascript",
      targets: ["client"],
    },
  ],
  outputs: {
    outDir: path.join(root, "dist"),
    fileName: "[entry].[target].[environment].[hash].js",
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
