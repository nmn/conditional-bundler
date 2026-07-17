# Cache Layout Refactor for Cell-Aligned Artifacts

## Summary

Restructure the disk cache so it mirrors the actual opaque inputs used by linking:

- The configured `cacheDir` becomes a base directory that contains config-scoped roots.
- Each config root contains a flat list of per-file folders named by a hash of the normalized file path.
- Each request cache contains a small JSON index, while cell artifacts are
  grouped by semantic module variant.
- The linker reads cached cell `.js` artifacts as opaque text for concatenation; it never depends on inline cell code stored in memory.

This reduces duplicated large JSON payloads, makes cache contents line up with bundle assembly, and lowers peak memory pressure by keeping worker cell code on disk instead of embedding it in every `FileRecord`.

## Key Changes

### Cache structure and keys

- Use `cacheDir/v2/<configHash>/` as the active cache root.
- Compute `configHash` from the fully normalized effective bundler config object, including the full config payload rather than a transform-only subset.
- Store a root `config.json` with:
  - normalized config snapshot
  - `configHash`
  - `createdAt`
  - `lastUsedAt`
- Store file caches under
  `cacheDir/v2/<configHash>/files/<filePathHash>/<requestHash>/`.
- `filePathHash` is a hash of the normalized absolute file path only; folder names are hash-only.
- Keep one `module.json` per request folder with:
  - `moduleKey`
  - `realPath`
  - file-level metadata
  - unique `ModuleVariantRecord`s with their environment membership
  - a compatibility environment-to-variant lookup
  - cell metadata and artifact filenames in source order
- `moduleKey` must include all worker-relevant inputs for a file:
  - normalized real path
  - pkg name, version, and root
  - syntax flags
  - scoped-transform inputs
  - source code hash
  - any per-env override code hashes
  - resolved-import tables
- Cache complete Babel pipelines separately under `transform-pipelines/`.
  Their keys exclude unrelated environments and resolution tables; an
  environment ID is included only when the pipeline contains scoped stages.
- Cache core transform results under `core-variants/`, keyed by transformed
  input, resolved imports, and effective HMR mode.

### Cached artifacts and linker consumption

- Persist one `.js` artifact per worker-emitted cell under
  `variants/<filePathHash>/<variantId>/`, named by stable cell order, e.g.
  `variants/<filePathHash>/<variantId>/000.js`.
- Persist only worker-produced cells this way:
  - normal worker cells
  - conditional binding cells
- Do not cache linker-generated alias/namespace cells; they remain generated in memory at link time.
- Change shared cell metadata so cached worker cells carry an artifact reference instead of inline code.
  - `CellRecord` should support `artifactPath` or equivalent persisted artifact reference.
  - Inline `code` remains allowed only for linker-generated cells.
- Builder/linker should consume `FileRecord` metadata only for semantics, then read worker cell `.js` files only when concatenating selected cells.
- Worker cache hits should validate `module.json` plus all referenced cell `.js` files exist, then return metadata without re-reading or embedding code strings.

### Worker and builder flow

- Builder computes the active config root once and passes that root to all workers.
- Worker no longer writes `records/` and `ir/` top-level blobs; all per-file cache state lives in the per-file folder.
- On cache miss, worker:
  - reuses or computes the complete shared/scoped transform pipeline
  - computes only the required scoped/resolution variants
  - groups identical environment results
  - writes per-cell `.js` files
  - writes `module.json`
  - returns the metadata form used by the builder
- On cache hit, worker:
  - reads `module.json`
  - validates `moduleKey`
  - returns metadata with artifact references
  - does not re-materialize inline code bodies
- The linker remains parser-free: reading cached `.js` files for concatenation is allowed, but no syntax analysis or rewriting is allowed there.

### Cleanup and compatibility

- Keep all new layout under `cacheDir/v2/`.
- Add best-effort cleanup at build startup:
  - update `lastUsedAt` on the active config root
  - delete non-active config roots under `v2/` whose `lastUsedAt` is older than 7 days
  - if `config.json` is missing, fall back to directory mtime
  - ignore cleanup failures
- Do not migrate legacy `records/` / `ir/` cache contents; they become unused legacy data.
- The existing `cacheDir` config remains the same externally, but its semantics become “base cache directory” rather than “direct artifact directory”.

## Important Internal Interface Changes

- `CellRecord` gains a persisted artifact reference for worker cells and allows inline `code` only for generated linker cells.
- `FileRecord` / worker response shape should no longer rely on inline worker cell code being present.
- Worker request/response flow should treat the cache root as config-scoped and already resolved by the builder.
- Any cache helper types should be updated to describe:
  - config root metadata
  - per-file module metadata
  - per-cell artifact naming/reference

## Test Plan

- Worker cache layout tests:
  - writes `v2/<configHash>/files/<filePathHash>/module.json`
  - writes one `.js` file per worker cell in stable order
  - cache hit does not rewrite `module.json` or cell artifacts when unchanged
  - missing cell artifact forces a rebuild of that file folder
- Config root tests:
  - different effective configs land in different config roots
  - changing a config field that affects the full config hash uses a different root
- Builder/linker tests:
  - builder can link successfully when worker `FileRecord`s contain artifact references instead of inline code
  - selected cells are concatenated from cached `.js` artifacts only
  - generated re-export/namespace cells still work unchanged
- Regression coverage:
  - existing dynamic import, re-export, conditional, namespace, treeshaking, and barrel tests continue to pass
  - cache reuse test updates to assert the new folder/file layout rather than `records/`

## Assumptions and Defaults

- Full normalized effective bundler config is the source for `configHash`, not a subset.
- Hash-only per-file folder names are preferred over readable slugs.
- Cleanup is best-effort with a 7-day retention window for inactive config roots.
- Legacy cache layout is not migrated or read; it is simply ignored by the new implementation.
- Current `BundlerConfig` is the temporary source for normalization and hashing until the user-facing bundler config layer exists; when that layer is added, the same scheme should switch to hashing that normalized effective config object.
