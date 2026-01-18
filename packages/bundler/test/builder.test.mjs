import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProject } from "../dist/builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const fixturesDir = path.join(rootDir, "test/fixtures");
const outDir = path.join(rootDir, "test/.out");

async function buildFixture(name) {
  const entry = path.join(fixturesDir, name, "src/index.js");
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  return buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: name, path: entry }],
      outputs: { outDir, fileName: `${name}.[env].[hash].js` },
      cacheDir: path.join(rootDir, "node_modules/.bundler-cache"),
      maxWorkers: 2,
      diagnostics: "human"
    },
    []
  );
}

async function readBundle(result) {
  const bundle = result.bundles[0];
  const bundlePath = path.join(outDir, bundle.fileName);
  return fs.readFile(bundlePath, "utf8");
}

test("bundles simple module graph", async () => {
  const result = await buildFixture("simple");
  const output = await readBundle(result);
  assert.ok(output.includes("__SIDE_EFFECT__"));
  assert.ok(output.includes("_foo"));
});

test("adds conditional markers", async () => {
  const result = await buildFixture("conditional");
  const output = await readBundle(result);
  assert.ok(output.includes("##CONDITION_START##"));
  assert.ok(output.includes("EXPERIMENT_A"));
});

test("emits namespace object for namespace imports", async () => {
  const result = await buildFixture("namespace");
  const output = await readBundle(result);
  assert.ok(output.includes("__NS__"));
});

test("handles export star with override", async () => {
  const result = await buildFixture("export-star");
  const output = await readBundle(result);
  assert.ok(output.includes("value"));
});

test("rewrites dynamic import to constant", async () => {
  const result = await buildFixture("dynamic-import");
  const output = await readBundle(result);
  assert.ok(/__IMPORT/.test(output));
});

test("rewrites import.meta url", async () => {
  const result = await buildFixture("import-meta");
  const output = await readBundle(result);
  assert.ok(output.includes("__BUNDLER_URL__"));
});

test("fails on top-level await", async () => {
  await assert.rejects(() => buildFixture("tla"), /E_TLA/);
});

