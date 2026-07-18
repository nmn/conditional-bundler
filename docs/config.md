# Configuration

Configuration is expected as a `bundler.config.ts` file. The public graph
model has three independent axes:

- `as` selects a module representation, such as JavaScript, URL, or raw text.
- `environment` is an opaque, flat semantic context inherited by ordinary
  imports. Plugins match environment names exactly.
- `target` is a named output profile that owns platform behavior, defines, and
  package resolution.

```ts
import { resolver } from "@bundler/bundler";

export default {
  targets: {
    server: {
      platform: "node",
      packageResolver: resolver("@bundler/node-package-resolver", {
        browserField: false,
      }),
      defines: { __SERVER__: true },
    },
    client: {
      platform: "browser",
      packageResolver: resolver("@bundler/browser-package-resolver", {
        browserField: true,
      }),
      defines: { __SERVER__: false },
    },
  },
  environments: {
    "react.server": {},
    "react.client": {},
  },
  entries: [
    {
      path: "src/server.jsx",
      environment: "react.server",
      targets: ["server"],
    },
  ],
  outputs: {
    outDir: "dist",
    fileName: "[entry].[target].[environment].[hash].js",
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
  imports: {
    bareImages: "image-reference-with-size",
    bareAssets: "url",
  },
  maxWorkers: 4,
  diagnostics: "human",
} as const;
```

The old `envs` configuration and arbitrary entry `id` fields are not accepted.
An entry is identified by its canonical path, environment, representation, and
requested target. An entry may omit `environment` only when exactly one is
configured, and may omit `targets` to request every configured target.

Environments contain no options, inheritance, base type, or `extends`
relationship. An ordinary import inherits its importer’s environment. An
attributed import may select another exact environment and, when deliberately
crossing output graphs, another target:

```js
import chunks from "./Counter.jsx" with {
  as: "url_and_deps_array",
  environment: "react.client",
  target: "client",
};
```

Targets can have arbitrary names. `platform` is either `"node"` or
`"browser"`. `defines` are compile-time values applied while producing that
target variant. `packageResolver` is a module-backed, fingerprinted resolver;
its module, contents, package version, and options participate in cache
invalidation. Browser-field and package-entry policy belongs in this resolver,
not in environments.

`cacheDir` is still supported as a shorthand for `cache.local.dir`, but new
configs should prefer `cache.local.dir`.

`debug: true` writes a disposable, readable mirror of every file transform.
When the cache directory is inside `.cache`, the mirror is written to
`.cache/__DEBUG__/`; otherwise it is written to `<cacheDir>/__DEBUG__/`.
Canonical package/workspace paths form the directory tree, with separate
representation, environment, and target-variant records containing the input,
transformed cells, extra outputs, maps, and metadata. The directory is deleted
before every build and is never read as a cache.

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

`imports.bareImages` and `imports.bareAssets` configure the representation
assigned to imports without an explicit `as` attribute. Both accept any
representation-handler name or `false`. Images default to
`"image-reference-with-size"` and other opaque assets default to `"url"`.
Representation identity is independent of environment identity. See
[`import-representations.md`](./import-representations.md) for normalization,
built-in behavior, and the plugin handler contract.

When `outputs.manifestFile` is set, the generated JSON `entrypoints` records
include the primary `bundleId` and `fileName`, the complete static script
closure in `bundles`, and the CSS files the server should load in `styles`.
Dynamic entrypoints have their own records, so a server can choose route CSS
without JavaScript injecting stylesheet loaders.

Entries and dynamically discovered entry points named `*.client.*` or
`*.browser.*` are emitted only for browser targets. Files named `*.server.*`
or `*.node.*` are emitted only for Node targets. Unsuffixed files remain
available to all requested targets.

`outputs.fileName` supports `[entry]`, `[target]`, `[environment]`, and
`[hash]`. When an identical physical bundle serves multiple targets,
`[target]` is a stable `shared-...` value. The equivalent rule applies when a
physical artifact is shared across semantic environments.

Module-backed plugins share Babel transform stages by default:

```ts
export default function examplePlugin() {
  return {
    name: "example",
    transform: [
      ["./shared-transform.mjs", {}],
      {
        plugin: ["./environment-transform.mjs", {}],
        environments: ["react.server"],
      },
      {
        plugin: ["./browser-transform.mjs", {}],
        targets: ["client"],
      },
    ],
  };
}
```

Shared stages receive the complete `environments` and `targets` sets and no
singular IDs. Environment-scoped stages receive `environmentId`;
target-scoped stages additionally receive `targetId` and `platform`.
Environment matching is exact. `transformFinalize` accepts the same spec
format and is the final pre-core normalization stage used by syntax plugins
that produce canonical attributed imports. A plugin can also coarsen
compatible reachability groups:

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

Manual labels cannot combine incompatible target or environment variants.
Linking runs once per target graph before structurally identical logical
chunks may be merged into a shared physical bundle.

`generateBundleResources` runs before bundle hashes are finalized. Its bundle
descriptors expose stable physical IDs and logical entrypoints, but not
filenames, because emitted resource bytes participate in `[hash]`. Plugins that
emit manifests containing final script filenames should do so from `buildEnd`,
whose bundle descriptors contain the finalized filenames.
