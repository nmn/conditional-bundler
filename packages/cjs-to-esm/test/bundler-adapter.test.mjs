import { fileURLToPath } from "node:url";
import cjsToEsmBundlerPlugin from "../bundler.mjs";

const fixture = fileURLToPath(
  new URL("./fixtures/static-basic.cjs", import.meta.url),
);

async function resolve({ buildMode, fromMode, kind, condition }) {
  const plugin = cjsToEsmBundlerPlugin({ mode: buildMode });
  return plugin.resolveImport({
    request: "./static-basic.cjs",
    fromId: "/project/parent.cjs",
    importerMeta: { format: "commonjs", mode: fromMode },
    envId: "client",
    kind,
    importAttributes: condition ? { condition } : undefined,
    resolveDefault: async () => ({
      id: fixture,
      filePath: fixture,
      moduleIdentity: "fixture@0.0.0::static-basic.cjs",
    }),
  });
}

test("resolves CommonJS dependencies to the same real file in every mode", async () => {
  const production = await resolve({
    buildMode: "production",
    fromMode: "development",
    kind: "conditional-import",
    condition: "env:NODE_ENV=production",
  });
  const development = await resolve({
    buildMode: "development",
    fromMode: "production",
    kind: "conditional-else",
    condition: "env:NODE_ENV=production",
  });

  expect(production).toMatchObject({
    id: fixture,
    filePath: fixture,
    type: "javascript",
    meta: { format: "commonjs" },
  });
  expect(development).toMatchObject({
    id: fixture,
    filePath: fixture,
    type: "javascript",
    meta: { format: "commonjs" },
  });
});

test("ordinary CJS dependencies retain explicit format metadata", async () => {
  const resolved = await resolve({
    buildMode: "development",
    fromMode: "production",
    kind: "import",
  });
  expect(resolved.meta).toEqual({ format: "commonjs" });
});

test("does not read NODE_ENV while configuring transform options", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const plugin = cjsToEsmBundlerPlugin();
    expect(plugin.transform[0][1]).not.toHaveProperty("mode");
    expect(plugin.transform[0][1]).not.toHaveProperty("nodeEnv");
    expect(
      cjsToEsmBundlerPlugin({ mode: "production" }).transform[0][1],
    ).toMatchObject({
      mode: "production",
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
