# Conditional Bundler

An experimental ESM-only bundler that rewrites import use-sites, preserves live bindings, and emits single-file ESM bundles with conditional chunks.

- ESM-only input and output
- Top-level await and cycles are rejected
- Parallel worker transforms with disk cache
- Conditional imports emitted with JSON markers
- Dynamic imports rewritten to bundle-top constants

## Packages

- `packages/bundler`: CLI + orchestrator + linker
- `packages/worker`: Babel-based transformer
- `packages/shared`: types + hashing + utils

## Build and Test

```bash
pnpm install
pnpm -r build
pnpm test
```
