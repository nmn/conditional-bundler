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
    sourceMap: "external",
    rootURL: "/static/",
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
  debug: true,
  css: true,
  maxWorkers: 4,
  diagnostics: "human",
} as const;
```

`cacheDir` is still supported as a shorthand for `cache.local.dir`, but new
configs should prefer `cache.local.dir`.

`debug: true` writes a disposable, readable mirror of every file transform.
When the cache directory is inside `.cache`, the mirror is written to
`.cache/__DEBUG__/`; otherwise it is written to `<cacheDir>/__DEBUG__/`.
Canonical package/workspace paths form the directory tree, with separate
intent and environment directories containing the input, transformed cells,
extra outputs, maps, and `record.json`. The directory is deleted before every
build and is never read as a cache.

`outputs.sourceMap` defaults to `false`. Use `"external"` to emit a linked
`<bundle>.js.map` file and a `sourceMappingURL` comment, or `"hidden"` to emit
the map without the comment. Use an object such as
`{ mode: "hidden", sourcesContent: false }` to omit embedded sources.

`outputs.rootURL` is the URL corresponding to `outputs.outDir`. It defaults to
`"/"`, so an emitted file named `assets/logo.svg` is referenced as
`/assets/logo.svg`. Set it to a path such as `"/static/"` or an absolute CDN URL
to prefix every linked output path. `outputs.publicPath` remains available as a
deprecated compatibility alias.
