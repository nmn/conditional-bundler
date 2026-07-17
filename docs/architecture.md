# Architecture

## Transform

- The coordinator reads real files, resolves dependency requests, and handles
  cache and output side effects.
- Pure file transforms consume bytes plus portable, explicit inputs and return
  serializable cells and metadata.
- Plain `transformPre`, `transform`, and `transformPost` stages are shared by
  default. They receive the complete environment set and no singular `envId`.
- A stage can opt into environment variants with
  `{ plugin, environments: "each" }` or an explicit environment list.
- Stage order is preserved. The worker runs each stage once per unique input
  variant, then groups environments whose transformed cells and resolved
  import tables are identical into a `ModuleVariantRecord`.
- Shared source transforms have a cache independent from resolved variants, so
  a module discovered in a later graph wave does not rerun common Babel work.
- Worker results are cached on disk in `tmp/.bundler-cache` and reused while inputs are unchanged.
- Cell, map, and extra-output artifacts are stored once for each variant rather
  than copied into environment-named directories.
- CSS files use ordered opaque cells; CSS Modules additionally emit a
  JavaScript class map.
- Plugins may emit typed data outputs for build-wide aggregation, such as
  StyleX rule metadata or Tailwind class candidates.
- Top-level bindings are renamed with a deterministic prefix.
- Import use-sites are rewritten to provider symbols.
- Dynamic imports are rewritten to `FILEHASH__IMPORT` constants.

## Graph

- Immutable module variants are shared, with a lightweight graph view per
  environment.
- Import requests are resolved per environment. Resolution state is keyed by
  environment and module identity so one graph cannot overwrite another.
- Export resolution, conditions, cycle detection, and selected cells remain
  environment-specific.
- Client/browser and server/node entry suffixes prune target-incompatible
  bundles before linking.
- Cycles and top-level await are rejected.
- `export *` is resolved per name with ambiguity omission.

## Link

- Range-based rewrites for all imported identifiers.
- JavaScript and CSS cells are treated as opaque; linking does not parse them.
- Asset URLs and dynamic bundle URLs are injected from metadata after final
  filenames are known.
- Namespace objects emitted only when needed.
- Conditional modules are wrapped in JSON markers.

## Bundle

- Explicit entries and dynamic imports are hard roots in the environment where
  they occur.
- Module ownership is computed from the consuming roots in each environment.
  A module used by one local root stays with that root; modules used by multiple
  local roots enter the default shared family. This prevents a source-shared
  module from creating a chunk cycle when its linked dependencies differ by
  environment. Plugins can coarsen compatible groups with `manualChunk`.
- Logical chunks are linked per environment first. Production chunks are then
  coalesced into one physical bundle only when their transformed modules,
  selected cells, bindings, references, resources, plugin output, and
  dependency chunk variants match.
- Development retains environment-specific physical bundles when HMR or React
  Refresh affects output.
- `BundleManifest.bundles` and `BuildResult.bundles` list unique physical
  bundles. `entrypoints` maps every logical `envId:entryId` to its physical
  bundle. Each entrypoint also records its static script dependency closure in
  `bundles` and its expected static stylesheets in `styles`; servers use this
  metadata to render script, preload, and stylesheet tags.
- Production JavaScript never injects DOM-based stylesheet loading. CSS stays
  a static output relationship in the manifest. Development HMR may update
  already-rendered stylesheet links without changing production link behavior.
- `[scope]` expands to one environment, `universal`, or a deterministic partial
  environment scope. `[env]` remains a compatibility alias.
- Bundle hashes include symbolic code, source maps, generated static and
  dynamic imports, dependency filenames, linked assets, and generated resource
  fingerprints. Logical module and entry identities are portable, so absolute
  workspace paths do not affect the hash. The self-referential
  `sourceMappingURL` comment is appended after hashing.
