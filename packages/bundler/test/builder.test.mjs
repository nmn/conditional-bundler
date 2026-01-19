import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(process.cwd());
const fixturesDir = path.join(rootDir, "test/fixtures");
const outRoot = path.join(rootDir, "test/.out");

async function buildFixture(name) {
  const entry = path.join(fixturesDir, name, "src/index.js");
  const outDir = path.join(outRoot, name);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const { buildProject } = await import("../dist/builder.js");
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

async function readBundle(result, name) {
  const bundle = result.bundles[0];
  const bundleDir = path.join(outRoot, name);
  const bundlePath = path.join(bundleDir, bundle.fileName);
  return fs.readFile(bundlePath, "utf8");
}

test("bundles simple module graph", async () => {
  const result = await buildFixture("simple");
  const output = await readBundle(result, "simple");
  expect(output).toContain("__SIDE_EFFECT__");
  expect(output).toContain("_foo");
});

test("adds conditional markers", async () => {
  const result = await buildFixture("conditional");
  const output = await readBundle(result, "conditional");
  expect(output).toContain("##CONDITION_START##");
  expect(output).toContain("EXPERIMENT_A");
});

test("emits namespace object for namespace imports", async () => {
  const result = await buildFixture("namespace");
  const output = await readBundle(result, "namespace");
  expect(output).toContain("__NS__");
});

test("handles export star with override", async () => {
  const result = await buildFixture("export-star");
  const output = await readBundle(result, "export-star");
  expect(output).toContain("value");
});

test("rewrites dynamic import to constant", async () => {
  const result = await buildFixture("dynamic-import");
  const output = await readBundle(result, "dynamic-import");
  expect(output).toMatch(/__IMPORT/);
});

test("rewrites import.meta url", async () => {
  const result = await buildFixture("import-meta");
  const output = await readBundle(result, "import-meta");
  expect(output).toContain("__BUNDLER_URL__");
});

test("fails on top-level await", async () => {
  await expect(buildFixture("tla")).rejects.toThrow("E_TLA");
});
