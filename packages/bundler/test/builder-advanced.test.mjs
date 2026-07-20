import fs from "node:fs/promises";
import path from "node:path";
import { withTestConfig } from "./test-config.mjs";

const rootDir = path.resolve(process.cwd());
const fixturesDir = path.join(rootDir, "test/fixtures");
const outRoot = path.join(rootDir, "test/.out");
const cacheRoot = path.join(rootDir, "tmp/test-cache");

async function buildFixture(name, options = {}) {
  const entry = path.join(fixturesDir, name, "src/index.js");
  const outDir = path.join(outRoot, name);
  const cacheDir = options.cacheDir ?? path.join(cacheRoot, name);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  return buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: name, path: entry }],
      outputs: { outDir, fileName: `${name}.[env].[hash].js` },
      cacheDir,
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

async function snapshotAllBundles(name) {
  const result = await buildFixture(name);
  const bundleDir = path.join(outRoot, name);
  const outputs = {};

  for (const bundle of [...result.bundles].sort((a, b) =>
    a.fileName.localeCompare(b.fileName),
  )) {
    const bundlePath = path.join(bundleDir, bundle.fileName);
    outputs[bundle.fileName] = await fs.readFile(bundlePath, "utf8");
  }

  return { name, outputs };
}

test("bundles complex exports", async () => {
  const snapshot = await snapshotFixture("complex-exports");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-exports",
  "output": "
const a3r8ltykg_star = 5;
const a3r8ltykg_shared = 2;
const g3mk7imh_foo = 10;
const a9fgiq3zb_thing = "ok";
const a9fgiq3zb_default = a9fgiq3zb_thing;
const ovq22obp_local = 1;
const ovq22obp_foo = g3mk7imh_foo;
const ovq22obp_Thing = a9fgiq3zb_default;
const ovq22obp_star = a3r8ltykg_star;
const ovq22obp_shared = a3r8ltykg_shared;
export { ovq22obp_local as local, ovq22obp_star as star, ovq22obp_shared as shared, ovq22obp_foo as foo, ovq22obp_Thing as Thing };",
}
`);
});

test("bundles complex conditional imports", async () => {
  const snapshot = await snapshotFixture("complex-conditional");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-conditional",
  "output": "
/////##CONDITION_START##"COND_A"
const a36rbcmmg_pick = value => \`pick:\${value}\`;
/////##CONDITION_END##
const a9anu99qu_shared = "shared";
/////##CONDITION_START##{"NOT":"COND_A"}
const a325y4qo2_pick = value => \`alt:\${value}\`;
/////##CONDITION_END##
let rhc85okp_pick;
/////##CONDITION_START##"COND_A"
rhc85okp_pick = a36rbcmmg_pick;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
rhc85okp_pick = a325y4qo2_pick;
/////##CONDITION_END##
function rhc85okp_run() {
  return rhc85okp_pick(a9anu99qu_shared);
}
export { rhc85okp_run as run };",
}
`);
});

test("bundles complex dynamic imports", async () => {
  const snapshot = await snapshotFixture("complex-dynamic");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-dynamic",
  "output": "const __bundler_d9pkv5gb60_output_url = [new URL("./complex-dynamic.browser.6co61pqn.js", import.meta.url).href];

const hadi3ogo_default = __bundler_d9pkv5gb60_output_url;
const a5wq2vqaf__bundler_dynamic_import = () => Promise.all(hadi3ogo_default.map(_bundler_dynamic_dependency_url => import(_bundler_dynamic_dependency_url))).then(_bundler_dynamic_modules => _bundler_dynamic_modules[0]);
async function a5wq2vqaf_load() {
  const mod = await a5wq2vqaf__bundler_dynamic_import();
  return mod.value;
}
export { a5wq2vqaf_load as load };",
}
`);
});

test("bundles complex namespace usage", async () => {
  const snapshot = await snapshotFixture("complex-namespace");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-namespace",
  "output": "
const a492lhg63_alpha = 1;
const a492lhg63_beta = 2;
function ogrrjbmv_run() {
  return a492lhg63_alpha + a492lhg63_beta;
}
export { ogrrjbmv_run as run };",
}
`);
});

test("treeshakes unrelated exports within a single module", async () => {
  const snapshot = await snapshotFixture("tree-shake-cells");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "tree-shake-cells",
  "output": "
function hbrhdh5h_helper() {
  return "used";
}
function hbrhdh5h_used() {
  return hbrhdh5h_helper();
}
const a5nhkkydu_value = hbrhdh5h_used();
export { a5nhkkydu_value as value };",
}
`);
});

test("only includes demanded reexports from a barrel", async () => {
  const snapshot = await snapshotFixture("barrel-selective");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "barrel-selective",
  "output": "
const a9vf2wzpd_alpha = 1;
const a7g48s548_alpha = a9vf2wzpd_alpha;
const ltuletut_value = a7g48s548_alpha;
export { ltuletut_value as value };",
}
`);
});

test("bundles a hybrid graph with conditionals, barrels, and dynamic namespace usage", async () => {
  const snapshot = await snapshotAllBundles("hybrid");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "hybrid",
  "outputs": {
    "hybrid.browser.gvgobzvg.js": "const __bundler_d7xkyvhykn_output_url = [new URL("./hybrid.browser.pk46wpan.id-x.js", import.meta.url).href];

const a2w8rxzb5_default = __bundler_d7xkyvhykn_output_url;
const oueauf3s_label = "base";
const a1zfnyfv5_label = oueauf3s_label;
/////##CONDITION_START##"FLAG_A"
const mydb1tex_feature = "alpha";
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
const j1cn3xqj_feature = "beta";
/////##CONDITION_END##
let cl2aeuiz_feature;
/////##CONDITION_START##"FLAG_A"
cl2aeuiz_feature = mydb1tex_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
cl2aeuiz_feature = j1cn3xqj_feature;
/////##CONDITION_END##
const cl2aeuiz__bundler_dynamic_import = () => Promise.all(a2w8rxzb5_default.map(_bundler_dynamic_dependency_url => import(_bundler_dynamic_dependency_url))).then(_bundler_dynamic_modules => _bundler_dynamic_modules[0]);
async function cl2aeuiz_run(key) {
  const mod = await cl2aeuiz__bundler_dynamic_import();
  return mod.default(\`\${a1zfnyfv5_label}:\${cl2aeuiz_feature}:\${key}\`);
}
export { cl2aeuiz_run as run };",
    "hybrid.browser.pk46wpan.js": "
const f29lxr59_suffix = "tail";
const __NS__f29lxr59 = Object.create(null);
Object.defineProperty(__NS__f29lxr59, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(__NS__f29lxr59, "suffix", { enumerable: true, get: () => f29lxr59_suffix });
Object.preventExtensions(__NS__f29lxr59);
const a3twm4c4q_default = function a3twm4c4q_finish(input) {
  return \`\${input}:\${__NS__f29lxr59.suffix}:\${__NS__f29lxr59["suffix"]}\`;
};
export { a3twm4c4q_default as default };",
  },
}
`);
});

test("reports when a conditional module also becomes unconditional", async () => {
  const result = await buildFixture("conditional-warning");
  expect(result.diagnostics).toEqual([
    {
      code: "W_CONDITIONAL_ESCAPED",
      envId: "browser::browser",
      file: "conditional-warning@1.0.0::src/helper.js::environment=browser",
      message:
        "Module is reachable both conditionally and unconditionally; emitting it unconditionally.",
      severity: "warning",
    },
  ]);
});
