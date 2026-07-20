# Architecture

## Transform

- The coordinator reads real files, resolves dependency requests, and handles
  cache and output side effects.
- Pure file transforms consume bytes plus portable, explicit inputs and return
  serializable cells and metadata.
- Transformation identity is the canonical file identity plus normalized
  representation (`as`) plus one exact, flat environment. Target is not part
  of this identity.
- Plain `transformPre`, `transform`, `transformFinalize`, and `transformPost`
  stages are shared by default. Pre, source, and final-normalization plugins
  are compiled together in their declared order before core import
  extraction. Shared stages receive the complete environment and target sets
  without singular IDs.
- A stage can opt into an exact environment with
  `{ plugin, environments: ["react.server"] }` and into target finalization
  with `{ plugin, targets: ["client"] }`.
- Processing is layered: shared syntax parsing/lowering, exact
  environment-specific transforms, target defines and transforms, import
  discovery, target package resolution, record generation, then structural
  grouping of identical target records.
- Shared and environment transform caches are independent from target
  finalization. Adding a target reuses those layers and computes only target
  work whose define/plugin/resolution fingerprint is missing.
- One logical transformation result owns grouped variants of the form
  `{ targetIds, record }`. If server and client records are structurally
  identical, both target names point at one immutable record.
- Worker results are cached on disk in `tmp/.bundler-cache` and reused while
  inputs are unchanged.
- Cell, map, and extra-output artifacts are stored once for each variant rather
  than copied into target-named directories.
- CSS files use ordered opaque cells; CSS Modules additionally emit a
  JavaScript class map.
- Plugins may emit typed data outputs for build-wide aggregation, such as
  StyleX rule metadata or Tailwind class candidates.
- Top-level bindings are renamed with a deterministic prefix.
- Import use-sites are rewritten to provider symbols.
- Author syntax is normalized to attributed imports before core extraction.
  Local literal dynamic imports become `url_and_deps_array` imports followed
  by parallel native imports. The loader selects the source module's
  deterministic `__NS__<prefix>` export from the target bundle at array index
  zero; configured entries instead expose their native entry namespace. The
  core does not generate dynamic-import loader constants.
- A represented module identity includes its normalized `as` value in
  addition to its environment variant.
- Representation inheritance belongs only to `as`. Environments have no
  inheritance, base type, or relationship to JavaScript representations.

## Graph

- There is one logical graph per target, keyed by semantic environment and
  module identity. Immutable records may be shared between those graphs.
- Ordinary imports inherit the importer’s environment. Explicit import
  attributes can switch to another exact environment and can deliberately
  reference an output in another target.
- Package imports are resolved by the selected target’s package resolver.
  Resolution state includes target and environment so one graph cannot
  overwrite another.
- Export resolution, conditions, cycle detection, and selected cells run
  independently for each target graph.
- Client/browser and server/node entry suffixes prune target-incompatible
  bundles before linking.
- Cycles and top-level await are rejected.
- `export *` is resolved per name with ambiguity omission.

## Link

- Range-based rewrites for all imported identifiers.
- JavaScript and CSS cells are treated as opaque; linking does not parse them.
- URLs for scripts, styles, assets, documents, and plugin resources use one
  logical output registry and are injected from metadata after final filenames
  are known.
- Script URL-array references resolve to the target-first transitive static
  bundle closure after chunk ownership and filenames are finalized.
- Configured entries export their provider symbols under the authored names.
  Other logical roots export only globally unique provider symbols. Dynamic
  roots additionally expose one deterministic `__NS__<prefix>` object so a
  loader can select the right logical module from a merged physical chunk.
- Namespace objects are otherwise emitted only when needed.
- Conditional modules are wrapped in JSON markers.

## Bundle

- Explicit entries and representation-declared normal module variants are hard
  roots in their requested target and environment.
- Module ownership is computed from the consuming roots in each target graph.
  A module used by one local root stays with that root; modules used by multiple
  local roots enter the default shared family. This prevents a source-shared
  module from creating a chunk cycle when its linked dependencies differ by
  target. Plugins can coarsen compatible groups with `manualChunk`.
- Logical chunks are linked per target first. In production, cross-scope
  dynamic roots with the same exact set of logical consumers are combined,
  allowing route-exclusive RSC client implementations to share one chunk and
  implementations used by several routes to form a shared chunk. The result
  records every original logical entrypoint. Chunks are then coalesced across
  targets into one physical bundle only when their transformed modules,
  selected cells, bindings, references, resources, plugin output, and
  dependency chunk variants match.
- Development retains target-specific physical bundles when HMR or React
  Refresh affects output.
- `BundleManifest.bundles` and `BuildResult.bundles` list unique physical
  bundles. `targetIds` records every logical target sharing a file, while
  `environmentIds` records its semantic environments. `entrypoints` maps each
  internal target/environment/path key to its physical bundle and records the
  static script closure in `bundles` plus expected stylesheets in `styles`.
- RSC uses no client-reference manifest. A `react.server` transform of a
  `"use client"` module is a side-effect-free reference facade, while the same
  source is transformed under `react.client` as the implementation requested
  by both SSR and browser targets.
- In `react.server`, source and generated JSX imports of `"react"` are
  rewritten to the bundler’s `"react-server"` alias before dependency
  extraction. The RSC plugin resolves that alias directly to its pinned
  server-compatible React implementation; it is not a package export
  condition. `react.client` implementations retain ordinary React in both
  targets.
- The facade registers the logical project path, deterministic globally
  unique export name, and a URL-only browser chunk array after linking. The
  first URL owns the implementation while the remaining URLs are its static
  dependency bundles. An independent module-relative array registers the SSR
  implementation.
- The browser imports all chunk URLs concurrently and selects the globally
  unique export from the first namespace. The server serializer reads inline
  reference metadata; SSR resolves the same deterministic export through the
  implementation registry. No Webpack chunk IDs, globals, or runtime shims
  are emitted.
- Production JavaScript never injects DOM-based stylesheet loading. CSS stays
  a static output relationship in the manifest. Development HMR may update
  already-rendered stylesheet links without changing production link behavior.
- `[target]` and `[environment]` expand to a single name or a deterministic
  `shared-...` name when a physical artifact serves multiple logical graphs.
- Bundle hashes include symbolic code, source maps, generated static imports,
  dependency filenames, referenced logical-output filenames and bytes, and
  generated resource fingerprints. Logical module and entry identities are
  portable, so absolute workspace paths do not affect the hash. The
  self-referential `sourceMappingURL` comment is appended after hashing.
