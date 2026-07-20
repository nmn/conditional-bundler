import { transform } from "./helpers/transform.mjs";

test("folds matching build-time environment imports before dependency discovery", async () => {
  const result = await transform(
    `import { feature } from "./development.js" with {
       NODE_ENV: "development",
       else: "./production.js"
     };
     export const selected = feature;`,
    {
      environmentVariables: { NODE_ENV: "development" },
    },
  );

  expect(result.meta.conditionalImports).toEqual([]);
  expect(result.meta.imports).toEqual([
    expect.objectContaining({
      request: "./development.js",
      source: "src/development.js",
    }),
  ]);
  expect(JSON.stringify(result)).not.toContain("production.js");
});

test("selects the build-time else dependency for a non-matching value", async () => {
  const result = await transform(
    `import { feature } from "./development.js" with {
       NODE_ENV: "development",
       else: "./production.js"
     };
     export const selected = feature;`,
    {
      environmentVariables: { NODE_ENV: "production" },
    },
  );

  expect(result.meta.conditionalImports).toEqual([]);
  expect(result.meta.imports).toEqual([
    expect.objectContaining({
      request: "./production.js",
      source: "src/production.js",
    }),
  ]);
  expect(JSON.stringify(result)).not.toContain("development.js");
});

test("removes a disabled build-time side-effect import", async () => {
  const result = await transform(
    `import "./development.js" with { NODE_ENV: "development" };
     export const selected = "production";`,
    {
      environmentVariables: { NODE_ENV: "production" },
    },
  );

  expect(result.meta.imports).toEqual([]);
  expect(result.code).toContain('"production"');
  expect(JSON.stringify(result)).not.toContain("development.js");
});

test("rejects ambiguous build-time conditional imports", async () => {
  await expect(
    transform(
      `import value from "./development.js" with {
         NODE_ENV: "development",
         condition: "isChrome",
         else: "./production.js"
       };`,
      {
        environmentVariables: { NODE_ENV: "production" },
      },
    ),
  ).rejects.toThrow("cannot mix runtime and build-time conditions");

  await expect(
    transform(
      `import value from "./development.js" with {
         NODE_ENV: "development"
       };`,
      {
        environmentVariables: { NODE_ENV: "production" },
      },
    ),
  ).rejects.toThrow("requires an 'else' branch");
});
