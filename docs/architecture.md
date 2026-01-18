# Architecture

## Transform

- Each module is parsed with Babel and transformed once per file.
- Top-level bindings are renamed with a deterministic prefix.
- Import use-sites are rewritten to provider symbols.
- Dynamic imports are rewritten to `FILEHASH__IMPORT` constants.

## Graph

- One module graph per environment.
- Cycles and top-level await are rejected.
- `export *` is resolved per name with ambiguity omission.

## Link

- Range-based rewrites for all imported identifiers.
- Namespace objects emitted only when needed.
- Conditional modules are wrapped in JSON markers.

## Bundle

- Concatenated single-file ESM output per entry.
- Bundle filenames include a content hash.
- Dynamic import constants are patched after bundle naming.
