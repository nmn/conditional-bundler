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
      diagnostics: "human",
    },
    [],
  );
}

async function readBundle(result, name) {
  const bundle = result.bundles[0];
  const bundleDir = path.join(outRoot, name);
  const bundlePath = path.join(bundleDir, bundle.fileName);
  return fs.readFile(bundlePath, "utf8");
}

async function snapshotFixture(name) {
  const result = await buildFixture(name);
  const output = await readBundle(result, name);
  return { name, output };
}

test("bundles simple module graph", async () => {
  const snapshot = await snapshotFixture("simple");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "simple",
  "output": "
const k7isotkd_foo = 2;
globalThis.__SIDE_EFFECT__ = true;


const a33jpi1jb_value = k7isotkd_foo + 1;",
}
`);
});

test("adds conditional markers", async () => {
  const snapshot = await snapshotFixture("conditional");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "conditional",
  "output": "
/////##CONDITION_START##"EXPERIMENT_A"
const ka1gyw5b_feature = "enabled";
/////##CONDITION_END##
/////##CONDITION_START##"EXPERIMENT_A"
const kftqz1jg_feature = ka1gyw5b_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_A"}
const kftqz1jg_feature = undefined;
/////##CONDITION_END##

const kftqz1jg_value = kftqz1jg_feature;",
}
`);
});

test("handles conditional else imports", async () => {
  const snapshot = await snapshotFixture("conditional-alt");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "conditional-alt",
  "output": "
/////##CONDITION_START##"EXPERIMENT_B"
const a57bqmm6a_feature = "yes";
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_B"}
const qb58dser_feature = "no";
/////##CONDITION_END##
/////##CONDITION_START##"EXPERIMENT_B"
const pvain3vm_feature = a57bqmm6a_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_B"}
const pvain3vm_feature = qb58dser_feature;
/////##CONDITION_END##

const pvain3vm_value = pvain3vm_feature;",
}
`);
});

test("emits namespace object for namespace imports", async () => {
  const snapshot = await snapshotFixture("namespace");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "namespace",
  "output": "
const rpl9aoch_answer = 7;
const rpl9aoch_name = "ns";

const a5wvqoyh8_value = __NS__rpl9aoch.answer;
const a5wvqoyh8_dynamic = __NS__rpl9aoch["answer"];
const __NS__a5wvqoyh8 = Object.create(null);
Object.defineProperty(__NS__a5wvqoyh8, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(__NS__a5wvqoyh8, "value", { enumerable: true, get: () => a5wvqoyh8_value });
Object.defineProperty(__NS__a5wvqoyh8, "dynamic", { enumerable: true, get: () => a5wvqoyh8_dynamic });
Object.preventExtensions(__NS__a5wvqoyh8);",
}
`);
});

test("handles export star with override", async () => {
  const snapshot = await snapshotFixture("export-star");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "export-star",
  "output": "
const a8h9vqgv5_value = "a";
const kzk1bb96_value = "b";
const d3sn4zje_bValue = kzk1bb96_value;",
}
`);
});

test("rewrites dynamic import to constant", async () => {
  const snapshot = await snapshotFixture("dynamic-import");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import",
  "output": "const __IMPORT_ra8btrgq = () => import("dynamic-import.browser.gilisr19.js");
async function ogy9gk4r_loadFoo() {
  const mod = await __IMPORT_ra8btrgq();
  return mod.foo;
}",
}
`);
});

test("dedupes dynamic import constants", async () => {
  const snapshot = await snapshotFixture("dynamic-import-shared");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import-shared",
  "output": "const __IMPORT_s5ot8viw = () => import("dynamic-import-shared.browser.m5ae8409.js");
async function pjxrtv5k_loadA() {
  return __IMPORT_s5ot8viw();
}
async function pjxrtv5k_loadB() {
  return __IMPORT_s5ot8viw();
}",
}
`);
});

test("rewrites import.meta url", async () => {
  const snapshot = await snapshotFixture("import-meta");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "import-meta",
  "output": "
const a2i26jx0t_asset = __BUNDLER_URL__("a2i26jx0t", "./asset.png").href;",
}
`);
});

test("fails on top-level await", async () => {
  await expect(buildFixture("tla")).rejects.toThrow("E_TLA");
});
