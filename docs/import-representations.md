# Import representations

The bundler uses import attributes as its canonical request for a file
representation:

```js
import assetUrl from "./logo.svg" with { as: "url" };
import source from "./message.txt" with { as: "raw" };
import image from "./logo.svg" with { as: "image-reference-with-size" };
```

`as` is an additional module-variant axis; it does not replace the
environment. A transform is selected by the environment, canonical file
identity, and normalized `as` representation. The representation handler is
part of the bundler configuration fingerprint, not the module identity. Other
import attributes may select graph or link behavior, but do not create another
source transform. The same file can therefore be transformed independently as
normal JavaScript, `as: "url"`, `as: "raw"`, or a plugin-defined representation
in each environment.

Consumer roles are deliberately not representation metadata. A dynamic
import, `Worker`, service worker, and audio worklet can all consume a URL to
the same ESM output.

## Pre-core normalization

Author-facing syntax is lowered by four standalone Babel plugin packages. Each
package can be configured and tested without the bundler core:

- `@bundler/dynamic-imports` converts a local literal `import("./feature.js")`
  to a deduplicated `as: "url_and_deps_array"` import and a loader that starts
  native imports for the target and its static bundle dependencies in
  parallel.
- `@bundler/query-imports` converts `?url`, `?worker&url`, `?raw`, `?base64`,
  and `.wasm?init` queries to `as`.
- `@bundler/import-attributes` moves legacy representation values from `type`
  to `as`, leaving source-format assertions such as `type: "json"` intact.
- `@bundler/asset-imports` assigns configurable representations to bare image
  and opaque-asset imports.

These plugins occupy the final positions in the single ordered Babel source
compilation before core import extraction. Keeping them in separate packages
does not cause the source file to be parsed or generated once per normalizer.
Nonliteral and runtime dynamic imports remain native expressions. The
attributed form is also a supported author- and plugin-facing dialect.

Bare images default to `image-reference-with-size`; other opaque assets
default to `url`. Configure the defaults with:

```js
export default {
  imports: {
    bareImages: "url", // any handler name, or false
    bareAssets: "url", // any handler name, or false
  },
};
```

## Built-in representations

- `url` returns the URL of the target's primary output. Opaque assets are
  copied. JavaScript and CSS declare the same file's normal variant as a
  separate entrypoint and link to its finalized script or stylesheet.
- `url_and_deps_array` is JavaScript-only. It returns a target-first array
  containing the normal module bundle URL followed by every direct and
  indirect static script dependency bundle URL, with duplicates removed.
  Dynamic-import loaders import every URL concurrently. For a non-configured
  entry, the target URL array also carries the source module's deterministic
  prefix, and the loader selects that module's `__NS__<prefix>` export from
  the first native namespace. Configured entries keep their public export
  names and return the first native namespace directly. This remains valid
  when multiple logical dynamic roots share one physical target bundle.
- `raw` exports the represented file's own bytes decoded as strict UTF-8.
- `base64` exports the base64 encoding of the represented file's own bytes.
- `image-reference-with-size` exports `{ src, width, height }`. Its generated
  facade imports the same image with `as: "url"`, so this representation is an
  ordinary self-edge to the URL variant.
- `wasm` is `.wasm`-only and exports an asynchronous initialization function.
  The original binary is emitted as a hashed `application/wasm` asset.
- `css-dependency` is provided by the CSS plugin for a JavaScript dependency
  on a CSS/CSS-Module transform and its linked stylesheet output.

Unknown values fail unless a plugin claims them.

## Executable WebAssembly

Bare `.wasm` imports retain the opaque-asset behavior and return a public URL.
Use `?init` or the canonical attributed form to compile and instantiate a
binary:

```js
import init from "./math.wasm?init";
import initAttributed from "./math.wasm" with { as: "wasm" };

const instance = await init({
  env: {
    offset(value) {
      return value + 1;
    },
  },
});
instance.exports.run();
```

Both forms default-export
`(imports = {}) => Promise<WebAssembly.Instance>`. The compiled
`WebAssembly.Module` is cached by the JavaScript facade, while every call
creates a fresh instance so mutable state and import objects are not shared.

HTTP(S) output uses streaming compilation when the response is served as
`application/wasm` and falls back to compiling its `ArrayBuffer` otherwise.
Module-relative `file:` output uses `node:fs/promises`, supporting
Node-compatible server bundles without embedding the binary in JavaScript.
Direct named exports from Wasm and automatic wiring of Wasm imports to
JavaScript modules are not supported; those require an asynchronous module
graph, while this bundler deliberately rejects top-level `await`.

TypeScript projects can describe the query form locally:

```ts
declare module "*.wasm?init" {
  const init: (imports?: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
  export default init;
}
```

## Atomicity and cache behavior

An importer transform may resolve dependency requests, but it never reads a
dependency's contents or transform result. Its cache input contains only its
own source, configuration, portable resolved identities, normalized requests,
handler identities, and resolver metadata.

Every represented variant reads only its own file. It may return a JavaScript
facade, portable discovered entrypoints, symbolic output references, and
extra outputs. The coordinator schedules each discovered `(environment,
module identity, as)` variant independently and resolves symbolic URLs only
after output filenames are final.

Logical output IDs are portable. Module bundles register their normal module
identity automatically; `ExtraTransformOutput` and `emitFile` may register an
explicit `outputId`. JavaScript references to module, style, and plugin
outputs are linked relative to the referencing bundle with
`new URL(relativeName, import.meta.url).href`.

## Plugin representations

A module-backed bundler plugin can claim an `as` value:

```js
export default function plugin() {
  return {
    name: "sprites",
    representations: {
      "sprite-url": {
        async resolve(context) {
          const resolved = await context.resolveDefault();
          if ("preserve" in resolved) return resolved;
          return { ...resolved, type: "asset" };
        },
        workerTransform: ["./sprite-worker.mjs", { scale: 2 }],
      },
    },
  };
}
```

The worker module exports a pure transform function. It receives the selected
representation, environment, portable identities, resolver metadata, and
that file's own `source` and `bytes`. It returns JavaScript `code` and may
also return `map`, `extraOutputs`, `discoveredEntrypoints`, and
`linkReferences`.

The return value must be serializable and contain no machine-specific paths.
The worker module and options are fingerprinted. A handler with multiple
outputs assigns each one a logical `outputId`; its facade identifies the
primary output for that representation with an `output-url` link reference.
