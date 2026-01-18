# Configuration

Configuration is expected as a `bundler.config.ts` file.

```ts
export default {
  envs: {
    browser: { conditions: ["default"], target: "browser" },
    node: { conditions: ["node"], target: "node" }
  },
  entries: [
    { id: "app", path: "src/index.js" }
  ],
  outputs: {
    outDir: "dist",
    fileName: "bundle.[env].[hash].js"
  },
  cacheDir: "node_modules/.bundler-cache",
  maxWorkers: 4,
  diagnostics: "human"
} as const;
```
