import {
  defaultFilePath,
  prefixFor,
  prefixForSource,
  transform,
} from "./helpers/transform.mjs";

function summarizeCells(result) {
  return result.fileRecord.cells.map((cell) => ({
    kind: cell.kind,
    sourceOrder: cell.sourceOrder,
    provides: cell.provides,
    internalDeps: cell.internalDeps,
    externalDeps: cell.externalDeps,
    eager: cell.eager,
    code: cell.code.replace(/\s+/g, " ").trim(),
  }));
}

test("splits unrelated exported functions into independent cells", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(`
    function helper() {
      return "ok";
    }

    export function first() {
      return helper();
    }

    export function second() {
      return "second";
    }
  `);

  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_helper`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `function ${prefix}_helper() { return "ok"; }`,
    },
    {
      kind: "worker",
      sourceOrder: 1,
      provides: [`${prefix}_first`],
      internalDeps: [`${prefix}_helper`],
      externalDeps: [],
      eager: false,
      code: `function ${prefix}_first() { return ${prefix}_helper(); }`,
    },
    {
      kind: "worker",
      sourceOrder: 2,
      provides: [`${prefix}_second`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `function ${prefix}_second() { return "second"; }`,
    },
  ]);
});

test("merges a trailing eager statement into the producer cell it immediately depends on", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(`
    const shared = 1;
    export const first = shared + 1;
    export const second = shared + 2;
    console.log(second);
  `);

  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_shared`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_shared = 1;`,
    },
    {
      kind: "worker",
      sourceOrder: 1,
      provides: [`${prefix}_first`],
      internalDeps: [`${prefix}_shared`],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_first = ${prefix}_shared + 1;`,
    },
    {
      kind: "worker",
      sourceOrder: 2,
      provides: [`${prefix}_second`],
      internalDeps: [`${prefix}_shared`],
      externalDeps: [],
      eager: true,
      code: `const ${prefix}_second = ${prefix}_shared + 2; console.log(${prefix}_second);`,
    },
  ]);
});

test("keeps unrelated eager top-level statements in their own cells", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(`
    export const second = 2;
    console.log("side-effect");
  `);

  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_second`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_second = 2;`,
    },
    {
      kind: "worker",
      sourceOrder: 1,
      provides: [],
      internalDeps: [],
      externalDeps: [],
      eager: true,
      code: `console.log("side-effect");`,
    },
  ]);
});

test("records static namespace property usage as specific external deps", async () => {
  const prefix = prefixFor(defaultFilePath);
  const depPrefix = prefixForSource("./dep.js");
  const result = await transform(`
    import * as ns from "./dep.js";

    export const total = ns.alpha + ns.beta;
  `);

  expect(result.fileRecord.flags.needsNamespaceObject).toBe(false);
  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_total`],
      internalDeps: [],
      externalDeps: [
        {
          kind: "import",
          source: "src/dep.js",
          request: "./dep.js",
          imported: "alpha",
        },
        {
          kind: "import",
          source: "src/dep.js",
          request: "./dep.js",
          imported: "beta",
        },
      ],
      eager: false,
      code: `const ${prefix}_total = ${depPrefix}_alpha + ${depPrefix}_beta;`,
    },
  ]);
});

test("records dynamic namespace usage as a namespace external dep", async () => {
  const prefix = prefixFor(defaultFilePath);
  const depPrefix = prefixForSource("./dep.js");
  const result = await transform(`
    import * as ns from "./dep.js";

    const key = "alpha";
    export const total = ns[key];
  `);

  expect(result.fileRecord.flags.needsNamespaceObject).toBe(true);
  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_key`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_key = "alpha";`,
    },
    {
      kind: "worker",
      sourceOrder: 1,
      provides: [`${prefix}_total`],
      internalDeps: [`${prefix}_key`],
      externalDeps: [
        {
          kind: "import",
          source: "src/dep.js",
          request: "./dep.js",
          imported: "*",
        },
      ],
      eager: false,
      code: `const ${prefix}_total = __NS__${depPrefix}[${prefix}_key];`,
    },
  ]);
});

test("creates conditional binding cells that feed later worker cells", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(`
    import { feature } from "./dep.js" with { condition: "FLAG", else: "./fallback.js" };

    export const value = feature;
  `);

  expect(summarizeCells(result)).toEqual([
    {
      kind: "conditional",
      sourceOrder: -1000,
      provides: [`${prefix}_feature`],
      internalDeps: [],
      externalDeps: [
        {
          kind: "import",
          source: "src/dep.js",
          request: "./dep.js",
          imported: "feature",
        },
        {
          kind: "import",
          source: "src/fallback.js",
          request: "./fallback.js",
          imported: "feature",
        },
      ],
      eager: false,
      code: `let ${prefix}_feature; /////##CONDITION_START##"FLAG" ${prefix}_feature = ${prefixForSource("./dep.js")}_feature; /////##CONDITION_END## /////##CONDITION_START##{"NOT":"FLAG"} ${prefix}_feature = ${prefixForSource("./fallback.js")}_feature; /////##CONDITION_END##`,
    },
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_value`],
      internalDeps: [`${prefix}_feature`],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_value = ${prefix}_feature;`,
    },
  ]);
});

test("assigns conditional bindings into bundle scope for HMR installers", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform(
    `import { feature } from "./dep.js" with { condition: "FLAG", else: "./fallback.js" };
     export const value = feature;`,
    { dev: { hmr: true } },
  );
  const conditionalCell = result.fileRecord.cells.find(
    (cell) => cell.kind === "conditional",
  );

  expect(conditionalCell.code).not.toContain(`let ${prefix}_feature`);
  expect(conditionalCell.code).toContain(
    `${prefix}_feature = ${prefixForSource("./dep.js")}_feature;`,
  );
  expect(result.code).not.toContain(`let ${prefix}_feature`);
});

test("keeps multi-declarator exports together in one cell", async () => {
  const prefix = prefixFor(defaultFilePath);
  const result = await transform("export const alpha = 1, beta = 2;");

  expect(summarizeCells(result)).toEqual([
    {
      kind: "worker",
      sourceOrder: 0,
      provides: [`${prefix}_alpha`, `${prefix}_beta`],
      internalDeps: [],
      externalDeps: [],
      eager: false,
      code: `const ${prefix}_alpha = 1, ${prefix}_beta = 2;`,
    },
  ]);
});

test("emits no worker cells for reexport-only modules", async () => {
  const result = await transform(`
    export * from "./dep.js";
    export { foo as bar } from "./dep.js";
    export * as ns from "./dep.js";
  `);

  expect(result.fileRecord.cells).toEqual([]);
});
