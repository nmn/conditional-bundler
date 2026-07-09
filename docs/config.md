# Configuration

Configuration is expected as a `bundler.config.ts` file.

```ts
export default {
  envs: {
    browser: { conditions: ["default"], target: "browser" },
    node: { conditions: ["node"], target: "node" },
  },
  entries: [{ id: "app", path: "src/index.js" }],
  outputs: {
    outDir: "dist",
    fileName: "bundle.[env].[hash].js",
  },
  cache: {
    local: {
      dir: "tmp/.bundler-cache",
      retentionDays: 7,
    },
    // Optional:
    // remote: cloudflareKVCache({
    //   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    //   namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID!,
    //   apiTokenEnv: "CLOUDFLARE_API_TOKEN",
    //   prefix: "my-app",
    // }),
  },
  css: true,
  maxWorkers: 4,
  diagnostics: "human",
} as const;
```

`cacheDir` is still supported as a shorthand for `cache.local.dir`, but new
configs should prefer `cache.local.dir`.
