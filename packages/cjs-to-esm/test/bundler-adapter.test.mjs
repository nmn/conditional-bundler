import path from "node:path";
import { fileURLToPath } from "node:url";
import cjsToEsmBundlerPlugin from "../bundler.mjs";
import { decodeCjsVirtualId, encodeCjsVirtualId } from "../index.mjs";

const fixture = fileURLToPath(
  new URL("./fixtures/static-basic.cjs", import.meta.url),
);

async function resolve({ buildMode, fromMode, kind, condition }) {
  const plugin = cjsToEsmBundlerPlugin({ mode: buildMode });
  return plugin.resolveImport({
    request: "./static-basic.cjs",
    fromId: encodeCjsVirtualId(
      "client",
      "/project/parent.cjs",
      undefined,
      fromMode,
    ),
    envId: "client",
    kind,
    importAttributes: condition ? { condition } : undefined,
    resolveDefault: async () => ({
      id: fixture,
      filePath: fixture,
      external: false,
    }),
  });
}

test("the build NODE_ENV overrides import attributes and parent modes", async () => {
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

  expect(decodeCjsVirtualId(production.id)).toMatchObject({
    mode: "production",
    filePath: path.resolve(fixture),
  });
  expect(decodeCjsVirtualId(development.id)).toMatchObject({
    mode: "development",
    filePath: path.resolve(fixture),
  });
});

test("ordinary CJS dependencies use the build NODE_ENV", async () => {
  const resolved = await resolve({
    buildMode: "development",
    fromMode: "production",
    kind: "import",
  });
  expect(decodeCjsVirtualId(resolved.id).mode).toBe("development");
});

test("captures NODE_ENV in transform options for cache fingerprinting", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const plugin = cjsToEsmBundlerPlugin();
    expect(plugin.transform[0][1]).toMatchObject({
      mode: "production",
      nodeEnv: "production",
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
