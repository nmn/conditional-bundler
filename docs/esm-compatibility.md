# ESM Compatibility and Intentional Deviations

Conditional Bundler is ESM-first, but it deliberately implements a narrower
module model and adds a small conditional-import dialect. This document is the
compatibility contract for intentional, observable differences from standard
ESM.

If behavior differs from ESM and is not listed here, it should be treated as a
bug or an undecided feature gap, not as an implicit design decision.

## Compatibility summary

| Area                     | Conditional Bundler behavior                                                                               | Status                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Conditional imports      | `condition` and `else` import attributes select a module branch during materialization                     | ESM extension                  |
| Cyclic graphs            | Static module cycles are unsupported and must be rejected                                                  | Intentional restriction        |
| Top-level `await`        | Modules using top-level `await` are rejected                                                               | Intentional restriction        |
| Selected bindings        | Linker-created aliases and conditional bindings are snapshots rather than live bindings                    | Intentional semantic deviation |
| Conditional source       | Marked build output is an intermediate artifact and is not executable until materialized                   | Intentional output format      |
| Marker-like source lines | The conditional start prefix and exact end marker are reserved in user and plugin-generated source         | Intentional source restriction |
| TypeScript               | TypeScript configuration enables parsing; lowering and type checking are plugin/toolchain responsibilities | Intentional syntax boundary    |
| Conditional CSS          | CSS from conditional branches may be emitted and applied unconditionally                                   | Temporary accepted limitation  |

## Conditional imports are an ESM extension

The bundler assigns custom semantics to `condition` and `else` import
attributes:

```js
import { checkout } from "./checkout-a.js" with {
  condition: "CHECKOUT_EXPERIMENT_A",
  else: "./checkout-b.js",
};
```

This is not ordinary import-attribute behavior. The condition is evaluated by
the conditional asset materializer, not by the JavaScript module loader. The
selected branch is retained and the other branch is erased before execution.

- When the condition is true, bindings and side effects come from the primary
  module.
- When the condition is false and `else` is present, they come from the
  fallback module.
- When the condition is false and `else` is absent, named, default, and
  namespace bindings receive `undefined`; side effects from the primary module
  are omitted.
- Nested conditional reachability is combined with `AND`, `OR`, and `NOT`
  expressions in the emitted marker metadata.

The primary and fallback modules are expected to provide compatible exports.
Conditional import selection is a build/materialization operation; it does not
provide runtime ESM linking or runtime export validation.

## The supported ESM graph is synchronous and acyclic

Standard ESM supports cyclic module graphs and asynchronous evaluation with
top-level `await`. Conditional Bundler intentionally supports neither.

- Any static cycle is outside the supported module model, including a module
  that statically imports or re-exports itself.
- A detected cycle must fail the build with `E_CYCLE`; the linker does not
  emulate ESM's cyclic instantiation, temporal dead zones, or partial
  initialization.
- Top-level `await`, including top-level `for await`, fails with `E_TLA`.
- `await` inside a function remains supported.

This restriction lets the linker use a synchronous dependency-before-consumer
evaluation order without a runtime module registry.

## Some selected bindings are snapshots

Standard ESM imports and re-exports are live bindings. Conditional Bundler
intentionally copies the current provider value when it creates certain
linker-generated bindings.

Snapshot behavior applies to:

- renamed local exports such as `export { value as current }`;
- named re-exports and aliases created by `export *`;
- named, default, and namespace bindings selected by a conditional import; and
- properties on the namespace-like object returned by a rewritten internal
  dynamic import.

For example:

```js
// source.js
export let value = 0;
export function increment() {
  value += 1;
}

// barrel.js
export { value as current, increment } from "./source.js";
```

After a consumer calls `increment()`, `current` still contains the value copied
when the bundle initialized. It does not track the later assignment to
`source.js`'s `value` binding.

This does not mean every import is copied. Ordinary direct named/default
imports are rewritten to their provider symbols, and generated static
namespace properties use provider-backed getters. Those remain live where no
snapshot alias is introduced.

## Conditional source must be materialized

The initial JavaScript output can contain both branches separated by marker
lines. It is an intermediate conditional-source format, not an executable ESM
file. Running it directly can execute code from mutually exclusive branches
and is unsupported.

Before serving or executing it, a materializer must:

1. evaluate every condition for one assignment;
2. erase inactive regions while preserving line structure; and
3. cache and serve the resulting ordinary JavaScript asset using that same
   assignment.

All chunks loaded by one page or request must use a consistent condition
assignment. A production integration must also give different materialized
permutations distinct cache identities, such as permutation-specific URLs or
an equivalent correct `Vary` policy. Emitting the conditional source file alone
does not establish that serving contract.

### Reserved marker lines

Materialization is intentionally parser-free and recognizes markers one line
at a time after trimming whitespace. The start prefix and exact end record are
therefore reserved:

```text
/////##CONDITION_START##
/////##CONDITION_END##
```

User source, template-literal contents, comments, and plugin-generated output
must not emit a trimmed line beginning with the start prefix or a trimmed line
equal to the end record. Indentation does not make such a line safe. The
deliberately unusual spelling minimizes accidental collisions; reserving it
avoids requiring the materializer to parse JavaScript.

## TypeScript is stripped automatically, without type-checking

The `.ts` and `.tsx` defaults enable Babel's TypeScript parser and the built-in
TypeScript plugin removes type syntax before the core transform runs. TSX keeps
its JSX syntax for a JSX transform such as `@bundler/react-jsx-plugin`.
`typescript: true` on another custom JS-like extension opts that extension into
the same type-removal transform.

The built-in transform does not:

- type-check;
- emit declarations;
- implement TypeScript module-resolution semantics; or
- provide TypeScript-specific runtime transforms or optimizations such as
  enum or `const enum` inlining.

The transform follows Babel's isolated-module TypeScript semantics.

## Conditional CSS is currently unconditional

JavaScript reachability is condition-aware, but stylesheet aggregation is not
yet materialized per condition assignment. CSS reachable only from either side
of a conditional import may be combined into the emitted stylesheet and
applied for every assignment.

This is an accepted temporary limitation. Conditional imports must not be used
to guarantee that mutually exclusive, security-sensitive, or globally
conflicting CSS is absent from the other variant.

## Other host and plugin extensions

These behaviors extend the accepted module dialect but are not claims about
ECMAScript's module semantics:

- CSS, CSS Modules, and static assets can be imported through plugins and
  produce plugin-defined JavaScript values or sidecar resources.
- `*.client.*` and `*.browser.*` entry points are limited to browser targets;
  `*.server.*` and `*.node.*` entry points are limited to Node targets.
- CommonJS is converted to ESM by the opt-in `cjs-to-esm` plugin. Its behavior
  is a compatibility transform, not native Node CommonJS execution.
- React Server Component boundaries, HMR, and React Refresh are plugin or
  development-runtime conventions and may replace normal module loading or
  re-execution behavior.
- Module-location transforms operate on emitted bundle URLs or paths because
  original source files are no longer runtime modules.

## Lowerings that are not intentional deviations

The following implementation techniques are expected to preserve observable
ESM behavior except where an explicit exception appears above:

- deterministic identifier renaming and shared-scope concatenation;
- dependency side-effect ordering and evaluate-once behavior;
- import immutability;
- explicit export precedence and `export *` ambiguity handling;
- static namespace-access reduction;
- dynamic-import Promise behavior and code splitting;
- tree shaking and shared-chunk extraction; and
- physical bundle coalescing, content hashing, and source-map composition.

A correctness difference caused by one of these techniques is a bug, not a new
compatibility rule. New intentional deviations should be added to this file and
covered by a focused test in the same change.
