import fs from "node:fs/promises";
import path from "node:path";

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
  const { buildProject } = await import("../dist/builder.js");
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
const a11gvr3t_star = 5;
const a11gvr3t_shared = 2;
const juo8zpng_foo = 10;
const a60qcqth9_thing = "ok";
const a60qcqth9_default = a60qcqth9_thing;
const rgvw7xif_foo = juo8zpng_foo;
const rgvw7xif_Thing = a60qcqth9_default;
const rgvw7xif_local = 1;",
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
const a7fe542m3_pick = value => \`pick:\${value}\`;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const m1lyft9j_pick = value => \`alt:\${value}\`;
/////##CONDITION_END##
const mag3x3is_shared = "shared";
/////##CONDITION_START##"COND_A"
const a1wam17ob_pick = a7fe542m3_pick;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const a1wam17ob_pick = m1lyft9j_pick;
/////##CONDITION_END##
function a1wam17ob_run() {
  return a1wam17ob_pick(mag3x3is_shared);
}",
}
`);
});

test("bundles complex dynamic imports", async () => {
  const snapshot = await snapshotFixture("complex-dynamic");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-dynamic",
  "output": "const __IMPORT_a7s65xr38 = () => import("complex-dynamic.browser.mmk2qf4d.js");
async function ia6xmlu2_load() {
  const mod = await __IMPORT_a7s65xr38();
  return mod.value;
}",
}
`);
});

test("bundles complex namespace usage", async () => {
  const snapshot = await snapshotFixture("complex-namespace");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "complex-namespace",
  "output": "
const k0ehfg11_alpha = 1;
const k0ehfg11_beta = 2;
function s509r9pf_run() {
  return k0ehfg11_alpha + k0ehfg11_beta;
}",
}
`);
});

test("bundles a hybrid graph with conditionals, barrels, and dynamic namespace usage", async () => {
  const snapshot = await snapshotAllBundles("hybrid");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "hybrid",
  "outputs": {
    "hybrid.browser.7994ucli.js": "const __IMPORT_kh774klk = () => import("hybrid.browser.fvogf1gi.js");
const kbgjp98n_label = "base";
const a7c4iu3zz_label = kbgjp98n_label;
/////##CONDITION_START##"FLAG_A"
const e68ec7o1_feature = "alpha";
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
const dvxo7bsl_feature = "beta";
/////##CONDITION_END##
/////##CONDITION_START##"FLAG_A"
const a54u0cy4f_feature = e68ec7o1_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
const a54u0cy4f_feature = dvxo7bsl_feature;
/////##CONDITION_END##
async function a54u0cy4f_run(key) {
  const mod = await __IMPORT_kh774klk();
  return mod.default(\`\${a7c4iu3zz_label}:\${a54u0cy4f_feature}:\${key}\`);
}",
    "hybrid.browser.fvogf1gi.js": "
const o5ufutef_suffix = "tail";
const kh774klk_default = function kh774klk_finish(input) {
  return \`\${input}:\${__NS__o5ufutef.suffix}:\${__NS__o5ufutef["suffix"]}\`;
};
const __NS__kh774klk = Object.create(null);
Object.defineProperty(__NS__kh774klk, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(__NS__kh774klk, "default", { enumerable: true, get: () => kh774klk_default });
Object.preventExtensions(__NS__kh774klk);",
  },
}
`);
});

test("reports when a conditional module also becomes unconditional", async () => {
  const result = await buildFixture("conditional-warning");
  expect(result.diagnostics).toEqual([
    {
      code: "W_CONDITIONAL_ESCAPED",
      envId: "browser",
      file: path.join(
        fixturesDir,
        "conditional-warning",
        "src/helper.js",
      ),
      message:
        "Module is reachable both conditionally and unconditionally; emitting it unconditionally.",
      severity: "warning",
    },
  ]);
});
