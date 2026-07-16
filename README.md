# Conditional Bundler

**An experiment-aware bundler that can serve each user a near-static bundle
containing only the code selected by that user's experiment conditions.**

## Why Conditional Bundling?

Consider an A/B test where half of users run checkout implementation A and the
other half run checkout implementation B.

With a typical bundler, there are two common choices:

- Put both implementations in the main bundle. Every user downloads both
  branches even though they will execute only one.
- Load the selected implementation with `import()`. Users avoid downloading
  the other branch, but the application pays for another network request and a
  request waterfall before it can run the selected code.

Conditional Bundler provides a third option. The application expresses the
choice as a conditional static import:

```js
import { checkout } from "./checkout-a.js" with {
  condition: "CHECKOUT_EXPERIMENT_A",
  else: "./checkout-b.js",
};
```

The bundler builds one conditional source bundle. Code reachable only through
a condition is placed in marked segments:

```js
/////##CONDITION_START##"CHECKOUT_EXPERIMENT_A"
// checkout A and its exclusive dependencies
/////##CONDITION_END##

/////##CONDITION_START##{"NOT":"CHECKOUT_EXPERIMENT_A"}
// checkout B and its exclusive dependencies
/////##CONDITION_END##
```

Before this bundle is served or executed, `@bundler/assets` evaluates the
user's conditions and erases the inactive segments to line-preserving
whitespace. A user in group A gets a normal ESM bundle containing checkout A
but not checkout B; a user in group B gets the opposite bundle. With normal
HTTP compression, the erased regions add negligible transfer cost.

For a single-entry application without explicit dynamic imports, this keeps
the selected experiment branch in the same bundle request as the rest of the
application. It reduces unused JavaScript without introducing a dynamic-import
waterfall.

### Prebuild or generate variants on demand

If a bundle has a small number of boolean conditions, all possible static
variants can be generated ahead of time. A bundle with `N` independent
conditions has at most `2^N` permutations, and the server or CDN can select the
correct immutable asset for each user.

When prebuilding every permutation would be wasteful, a condition-aware asset
server can materialize variants on demand:

1. Determine the condition values for the request.
2. Convert those values to a stable permutation key.
3. Strip inactive segments from the conditional source bundle.
4. Cache and serve the resulting static ESM asset.

Each permutation is generated only once. Later users with the same experiment
values receive the cached asset directly. This makes the output near-static:
the first request for a new permutation may generate it, while subsequent
requests are ordinary cache hits.

The conditional source bundle is an intermediate artifact and must be
materialized before execution. Its markers are comments; executing it without
stripping inactive regions is not supported.

## The Other Goal: Never Transform an Unchanged File Again

The second architectural goal is to make file transformation pure, portable,
parallel, and permanently cacheable for a fixed build configuration.

Within a particular transform configuration, a file transformation is
identified by:

- the file's normalized identity: project-relative for workspace files and
  package-relative for dependencies;
- the file's contents; and
- the fingerprint of the transform configuration and plugins.

The transform may resolve the import specifiers found in
that file. It receives portable identities for those imports, but it does not
read their contents or inspect unrelated files. Import aliases and package
resolution can change how a specifier resolves; the resolved identities are
explicit transform inputs and participate in cache validation.

A transform performs no output or filesystem side effects. It returns
serializable code artifacts and metadata to the coordinator. Because one
file's transform does not depend on transforming another file first, newly
discovered files can be transformed in parallel.

### Portable identities

Transformation results must not contain machine-specific absolute paths. The
same checkout may live at `/Users/alice/project`, `/home/bob/project`, or a CI
workspace, but equivalent source files receive the same normalized portable
identity.

Top-level identifiers are also renamed to deterministic, globally unique
names. This prevents declarations from different modules from colliding when
their transformed output is later concatenated into one scope.

Together, these constraints mean that a cached transform produced on one
computer can be reused on another computer.

### Shared remote cache

Local caching avoids repeating work between builds on one machine. The same
cache model can be backed by remote storage and shared by a team, CI, and
deployment systems.

When one developer transforms a new version of a file, that result can be
uploaded under its content- and configuration-derived cache key. Anyone who
later checks out the same contents can reuse the result immediately. CI and
production builds do not need to re-run a transform merely because they are
running on different machines.

Changing the file contents, relevant dependency resolutions, build
configuration, or transform/plugin fingerprint produces a different cache
entry. Otherwise, the transformation result is intended to remain reusable
indefinitely.

## Two-Phase Architecture

The portability and conditional-bundle model depend on a strict boundary
between transformation and linking.

### Phase 1: Transform files atomically

Workers parse and transform individual files as they are discovered. For each
file they:

- convert the module into link-ready output fragments called cells;
- rename top-level identifiers so they are globally unique;
- rewrite internal import use-sites to refer to provider symbols;
- record imports, exports, conditions, side effects, and cell dependencies;
- record source maps and symbolic references to generated resources; and
- return a serializable transform result.

A cell contains output text plus metadata describing the symbols it provides
and the cells or imports it needs. The transform result is self-contained: the
linker does not need the original source file or another module's source to
understand it. After the pure transform completes, the surrounding cache layer
may persist that returned result locally or remotely.

### Phase 2: Link cached transformation results

The linker reads only transformation records. Using their metadata, it builds
the module graph, resolves exports, propagates conditional reachability, and
selects the cells required by each entry.

Linking does not parse JavaScript. Selected cells are already valid in a shared
scope because their identifiers were made globally unique during
transformation. Generating a bundle is therefore mostly:

1. order dependency cells before their consumers;
2. concatenate the selected output text;
3. add small generated imports, exports, condition markers, or runtime
   preludes; and
4. patch symbolic output and asset references after filenames are known.

This makes relinking much cheaper than retransformation. Changing entries or
bundle partitioning can reuse the same file transforms as long as the
transform configuration remains compatible. Changing experiment values is
cheaper still: it requires only conditional materialization, not
retransformation or relinking.

## Architectural Constraints

- **Conditional variants are finite permutations.** Prebuilding scales as
  `2^N` for `N` independent boolean conditions. Large or sparsely used
  condition spaces should use on-demand materialization and caching.
- **Materialization happens before execution.** The emitted conditional source
  artifact contains all branches. Only a materialized variant provides the
  download-size benefit and correct conditional semantics.
- **Transforms are deterministic and side-effect free.** A transform or plugin
  that reads undeclared external state, embeds local absolute paths, or mutates
  the filesystem breaks portable caching.
- **Transforms may resolve only their own imports.** Aliases, package exports,
  target conditions, and resolver plugins are supported, but their results
  must become explicit, portable inputs rather than hidden filesystem
  dependencies.
- **The linker is parser-free.** Any operation that requires understanding or
  rewriting JavaScript syntax belongs in the transform phase.
- **The core graph is ESM-first.** CommonJS is converted to ESM by the
  `cjs-to-esm` plugin before normal linking.
- **Cycles and top-level `await` are explicitly rejected.** The current linker
  relies on a synchronous acyclic evaluation order rather than a runtime module
  registry.
- **Explicit code splitting still behaves like code splitting.** Authored
  dynamic imports and multi-entry shared bundles may produce additional files.
  Conditional static imports are the mechanism for selecting an experiment
  branch without adding a dynamic-import waterfall.

## Smaller Implementation Details

- Environment-specific package conditions and `node`/`browser` targets are
  resolved independently.
- Static namespace access is reduced to named symbol dependencies. Namespace
  objects are generated only when dynamic namespace behavior is required.
- The linker may inject a small prelude for generated asset URLs, dynamic
  bundle URLs, CSS loading, module paths, or HMR.
- Output filenames are content hashed after combined code and resource
  dependencies are known.
- Source maps are generated per transform cell and composed while
  concatenating selected cells.

## Packages

- `packages/bundler`: coordinator, resolver, graph builder, linker, and CLI
- `packages/assets`: conditional variant materialization and permutation cache
  keys
- `packages/worker`: atomic Babel-based file transforms and cell generation
- `packages/shared`: portable IR, condition types, hashing, and cache utilities
- `packages/cjs-to-esm`: CommonJS-to-ESM transform plugin

More implementation detail is available in
[`architecture.md`](./architecture.md), with configuration documented in
[`config.md`](./config.md).

## Build and Test

```bash
pnpm install
pnpm -r build
pnpm test
```
