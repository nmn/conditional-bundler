import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

test("workspace package exports the public configuration helpers", async () => {
  const publicApi = await import("@bundler/bundler");

  expect(typeof publicApi.plugin).toBe("function");
  expect(typeof publicApi.resolver).toBe("function");
  expect(typeof publicApi.runCli).toBe("function");
});

test("lightningcss resolves from both packages that directly own it", () => {
  const requireFromTest = createRequire(import.meta.url);
  const cssPluginEntry = requireFromTest.resolve("@bundler/css-plugin");
  const workerEntry = requireFromTest.resolve("@bundler/worker/worker");

  expect(
    createRequire(pathToFileURL(cssPluginEntry)).resolve("lightningcss"),
  ).toMatch(/lightningcss/);
  expect(
    createRequire(pathToFileURL(workerEntry)).resolve("lightningcss"),
  ).toMatch(/lightningcss/);
});
