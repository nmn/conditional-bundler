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
    fileName: "[entry].[scope].[hash].js",
    manifestFile: "manifest.json",
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
  transforms: {
    css: "lightningcss",
    jsLike: {
      ".jsx": { jsx: true },
      ".tsx": { jsx: true, typescript: true },
    },
  },
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

CSS defaults to the constrained Lightning CSS transform. Set
`transforms.css: false` to disable it; `css: false` remains a compatibility
alias. Arbitrary Lightning CSS options are intentionally rejected because
minification, syntax lowering, and other whole-stylesheet work belongs after
linking.

The built-in JS-like extensions are `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`,
`.tsx`, and `.json`. Add custom extensions through `transforms.jsLike`,
declaring only whether JSX and TypeScript syntax are enabled. JSON files are
handled by the built-in JSON plugin and become JavaScript modules with one
default export.
Types are removed from `.ts` and `.tsx` automatically with Babel's TypeScript
transform. TSX syntax remains available to a JSX transform such as
`@bundler/react-jsx-plugin`; the built-in TypeScript transform does not
type-check.

When `outputs.manifestFile` is set, the generated JSON `entrypoints` records
include the primary `bundleId` and `fileName`, the complete static script
closure in `bundles`, and the CSS files the server should load in `styles`.
Dynamic entrypoints have their own records, so a server can choose route CSS
without JavaScript injecting stylesheet loaders.

Entries and dynamically discovered entry points named `*.client.*` or
`*.browser.*` are emitted only for browser environments. Files named
`*.server.*` or `*.node.*` are emitted only for Node environments. Unsuffixed
files remain available to both targets.

`outputs.fileName` supports `[entry]`, `[scope]`, `[env]`, and `[hash]`.
`[scope]` is the environment ID for an environment-specific physical bundle,
`universal` when every configured environment shares it, or a stable joined
scope for partial sharing. `[env]` is an alias for `[scope]`.

Module-backed plugins share Babel transform stages by default:

```ts
export default function examplePlugin() {
  return {
    name: "example",
    transform: [
      ["./shared-transform.mjs", {}],
      {
        plugin: ["./environment-transform.mjs", {}],
        environments: "each",
      },
      {
        plugin: ["./browser-transform.mjs", {}],
        environments: ["browser"],
      },
    ],
  };
}
```

Shared stages receive `envs` and no `envId`. Scoped stages receive both `envs`
and the current `envId`. A plugin can also coarsen compatible reachability
groups:

```ts
export default {
  name: "vendor-chunks",
  manualChunk(moduleInfo) {
    "vendor-chunks-v1";
    return moduleInfo.filePath.includes("/node_modules/")
      ? "vendor"
      : undefined;
  },
};
```

Manual labels cannot combine module variants with incompatible environment
availability. Linking still runs for each environment before compatible logical
chunks are merged into a physical bundle.

`generateBundleResources` runs before bundle hashes are finalized. Its bundle
descriptors expose stable physical IDs and logical entrypoints, but not
filenames, because emitted resource bytes participate in `[hash]`. Plugins that
emit manifests containing final script filenames should do so from `buildEnd`,
whose bundle descriptors contain the finalized filenames.
