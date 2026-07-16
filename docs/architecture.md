# Architecture

## Transform

- The coordinator reads real files, resolves dependency requests, and handles
  cache and output side effects.
- Pure file transforms consume bytes plus portable, explicit inputs and return
  serializable cells and metadata.
- Overlapping environments are transformed in one worker request. Declared
  environment-independent stages are reused across those environments.
- Worker results are cached on disk in `tmp/.bundler-cache` and reused while inputs are unchanged.
- CSS files use ordered opaque cells; CSS Modules additionally emit a
  JavaScript class map.
- Plugins may emit typed data outputs for build-wide aggregation, such as
  StyleX rule metadata or Tailwind class candidates.
- Top-level bindings are renamed with a deterministic prefix.
- Import use-sites are rewritten to provider symbols.
- Dynamic imports are rewritten to `FILEHASH__IMPORT` constants.

## Graph

- One module graph per environment.
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

- Concatenated single-file ESM output per entry.
- Bundle filenames include a content hash.
- Dynamic import constants are patched after bundle naming.
