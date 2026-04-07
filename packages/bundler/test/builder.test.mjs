import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { contentHash, normalizePosixPath } from "@bundler/shared";

const rootDir = path.resolve(process.cwd());
const fixturesDir = path.join(rootDir, "test/fixtures");
const outRoot = path.join(rootDir, "test/.out");
const cacheRoot = path.join(rootDir, "tmp/test-cache");
const execFileAsync = promisify(execFile);

async function buildFixture(name, options = {}) {
  const entry = path.join(fixturesDir, name, "src/index.js");
  const outDir = path.join(outRoot, name);
  const cacheDir = options.cacheDir ?? path.join(cacheRoot, name);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const { buildProject } = await import("../dist/builder.js");
  return buildProject(
    {
      envs: options.envs ?? {
        browser: { conditions: ["default"], target: "browser" },
      },
      entries: options.entries ?? [{ id: name, path: entry }],
      outputs: options.outputs ?? {
        outDir,
        fileName: `${name}.[env].[hash].js`,
      },
      cacheDir,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: options.configPlugins ?? [],
    },
    options.plugins ?? [],
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
globalThis.__SIDE_EFFECT__ = true;
const k7isotkd_foo = 2;
const a33jpi1jb_value = k7isotkd_foo + 1;
export { a33jpi1jb_value as value };",
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
const kftqz1jg_value = kftqz1jg_feature;
export { kftqz1jg_value as value };",
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
const pvain3vm_value = pvain3vm_feature;
export { pvain3vm_value as value };",
}
`);
});

test("inherits and combines nested conditional imports", async () => {
  const snapshot = await snapshotFixture("inherited-conditional");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "inherited-conditional",
  "output": "
/////##CONDITION_START##{"AND":["COND_A","COND_B"]}
const rw4545i1_helper = "helper";
/////##CONDITION_END##
/////##CONDITION_START##{"AND":["COND_A",{"NOT":"COND_B"}]}
const pm2t2idw_helper = "fallback";
/////##CONDITION_END##
/////##CONDITION_START##"COND_A"
/////##CONDITION_START##"COND_B"
const sa8r0y59_helper = rw4545i1_helper;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_B"}
const sa8r0y59_helper = pm2t2idw_helper;
/////##CONDITION_END##
const sa8r0y59_feature = sa8r0y59_helper;
/////##CONDITION_END##
/////##CONDITION_START##"COND_A"
const a2u80kk0g_feature = sa8r0y59_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const a2u80kk0g_feature = undefined;
/////##CONDITION_END##
function a2u80kk0g_run() {
  return a2u80kk0g_feature;
}
export { a2u80kk0g_run as run };",
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
const __NS__rpl9aoch = Object.create(null);
Object.defineProperty(__NS__rpl9aoch, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(__NS__rpl9aoch, "answer", { enumerable: true, get: () => rpl9aoch_answer });
Object.defineProperty(__NS__rpl9aoch, "name", { enumerable: true, get: () => rpl9aoch_name });
Object.preventExtensions(__NS__rpl9aoch);
const a5wvqoyh8_value = __NS__rpl9aoch.answer;
const a5wvqoyh8_dynamic = __NS__rpl9aoch["answer"];
export { a5wvqoyh8_value as value, a5wvqoyh8_dynamic as dynamic };",
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
const d3sn4zje_value = a8h9vqgv5_value;
const d3sn4zje_bValue = kzk1bb96_value;
export { d3sn4zje_value as value, d3sn4zje_bValue as bValue };",
}
`);
});

test("rewrites dynamic import to constant", async () => {
  const snapshot = await snapshotFixture("dynamic-import");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import",
  "output": "const __IMPORT_ra8btrgq = () => import("./dynamic-import.browser.sp6pcy52.js").then((mod) => Object.freeze({ "foo": mod["ra8btrgq_foo"] }));
async function ogy9gk4r_loadFoo() {
  const mod = await __IMPORT_ra8btrgq();
  return mod.foo;
}
export { ogy9gk4r_loadFoo as loadFoo };",
}
`);
});

test("dedupes dynamic import constants", async () => {
  const snapshot = await snapshotFixture("dynamic-import-shared");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import-shared",
  "output": "const __IMPORT_s5ot8viw = () => import("./dynamic-import-shared.browser.v345apxf.js").then((mod) => Object.freeze({ "shared": mod["s5ot8viw_shared"] }));
async function pjxrtv5k_loadA() {
  return __IMPORT_s5ot8viw();
}
async function pjxrtv5k_loadB() {
  return __IMPORT_s5ot8viw();
}
export { pjxrtv5k_loadA as loadA, pjxrtv5k_loadB as loadB };",
}
`);
});

test("rewrites import.meta url", async () => {
  const snapshot = await snapshotFixture("import-meta");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "import-meta",
  "output": "
const a2i26jx0t_asset = __BUNDLER_URL__("a2i26jx0t", "./asset.png").href;
export { a2i26jx0t_asset as asset };",
}
`);
});

test("fails on top-level await", async () => {
  await expect(buildFixture("tla")).rejects.toThrow("E_TLA");
});

test("reuses cached worker artifacts for unchanged modules", async () => {
  const cacheDir = path.join(cacheRoot, "simple-cache-hit");
  await fs.rm(cacheDir, { recursive: true, force: true });

  await buildFixture("simple", { cacheDir });
  const v2Dir = path.join(cacheDir, "v2");
  const configRoots = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(configRoots).toHaveLength(1);

  const activeRoot = path.join(v2Dir, configRoots[0]);
  const configJson = JSON.parse(
    await fs.readFile(path.join(activeRoot, "config.json"), "utf8"),
  );
  expect(configJson.configHash).toBe(configRoots[0]);

  const entryPath = path.join(fixturesDir, "simple", "src/index.js");
  const entryFileHash = contentHash(normalizePosixPath(entryPath));
  const entryModulePath = path.join(
    activeRoot,
    "files",
    entryFileHash,
    "module.json",
  );
  const moduleJson = JSON.parse(await fs.readFile(entryModulePath, "utf8"));
  const fileRecord =
    moduleJson.fileRecordsByEnv?.browser ??
    moduleJson.fileRecordsByEnv?.default ??
    moduleJson.fileRecord;
  const artifactPaths = fileRecord.cells
    .map((cell) => cell.artifactPath)
    .filter(Boolean);
  expect(artifactPaths.length).toBeGreaterThan(0);
  await Promise.all(artifactPaths.map((artifactPath) => fs.stat(artifactPath)));

  const firstModuleStat = await fs.stat(entryModulePath);
  const firstArtifactStat = await fs.stat(artifactPaths[0]);

  await new Promise((resolve) => setTimeout(resolve, 25));
  await buildFixture("simple", { cacheDir });

  const secondModuleStat = await fs.stat(entryModulePath);
  const secondArtifactStat = await fs.stat(artifactPaths[0]);
  expect(secondModuleStat.mtimeMs).toBe(firstModuleStat.mtimeMs);
  expect(secondArtifactStat.mtimeMs).toBe(firstArtifactStat.mtimeMs);
});

test("uses different config roots when the bundler config changes", async () => {
  const cacheDir = path.join(cacheRoot, "config-roots");
  await fs.rm(cacheDir, { recursive: true, force: true });

  await buildFixture("simple", { cacheDir });

  const entry = path.join(fixturesDir, "simple", "src/index.js");
  const outDir = path.join(outRoot, "simple-alt-config");
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const { buildProject } = await import("../dist/builder.js");
  await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "simple", path: entry }],
      outputs: { outDir, fileName: "alt.[env].[hash].js" },
      cacheDir,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );

  const v2Dir = path.join(cacheDir, "v2");
  const configRoots = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  expect(configRoots).toHaveLength(2);
});

test("supports env-specific externalized imports via resolveImport", async () => {
  const result = await buildFixture("simple", {
    envs: {
      client: { conditions: ["default"], target: "browser" },
      ssr: { conditions: ["node"], target: "node" },
    },
    outputs: {
      outDir: path.join(outRoot, "simple-external"),
      fileName: "simple-external.[env].[hash].js",
    },
    configPlugins: [
      {
        name: "externalize-foo-in-ssr",
        resolveImport: {
          ssr: async ({ request }) =>
            request === "./foo.js" ? null : undefined,
        },
      },
    ],
  });

  const outDir = path.join(outRoot, "simple-external");
  const clientBundle = result.bundles.find(
    (bundle) => bundle.envId === "client",
  );
  const ssrBundle = result.bundles.find((bundle) => bundle.envId === "ssr");
  const clientCode = await fs.readFile(
    path.join(outDir, clientBundle.fileName),
    "utf8",
  );
  const ssrCode = await fs.readFile(
    path.join(outDir, ssrBundle.fileName),
    "utf8",
  );

  expect(clientCode).not.toContain('import { foo } from "./foo.js";');
  expect(ssrCode).toContain('import { foo } from "./foo.js";');
  expect(ssrCode).toContain("globalThis.__SIDE_EFFECT__ = true;");
});

test("supports virtual modules through resolveImport and load", async () => {
  const fixtureName = "plugin-virtual";
  const virtualPath = path.join(outRoot, ".virtual", "virtual-msg.js");
  const result = await buildFixture(fixtureName, {
    configPlugins: [
      {
        name: "virtual-msg",
        resolveImport: async ({ request }) =>
          request === "virtual:msg"
            ? { id: "virtual:msg", filePath: virtualPath, virtual: true }
            : undefined,
        load: async ({ id }) =>
          id === "virtual:msg"
            ? { code: 'export const msg = "hello from virtual";' }
            : undefined,
      },
    ],
  });

  const output = await readBundle(result, fixtureName);
  expect(output).toContain('"hello from virtual"');
  expect(output).toContain("export {");
});

test("runs module-backed worker transforms per environment", async () => {
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/env-transform-plugin.mjs",
  );
  const result = await buildFixture("plugin-transform", {
    envs: {
      client: { conditions: ["default"], target: "browser" },
      ssr: { conditions: ["node"], target: "node" },
    },
    outputs: {
      outDir: path.join(outRoot, "plugin-transform"),
      fileName: "plugin-transform.[env].[hash].js",
    },
    configPlugins: [
      {
        __bundlerPluginRef: true,
        module: pluginModule,
        options: { defaultValue: "server", clientValue: "client" },
      },
    ],
  });

  const outDir = path.join(outRoot, "plugin-transform");
  const clientBundle = result.bundles.find(
    (bundle) => bundle.envId === "client",
  );
  const ssrBundle = result.bundles.find((bundle) => bundle.envId === "ssr");
  const clientCode = await fs.readFile(
    path.join(outDir, clientBundle.fileName),
    "utf8",
  );
  const ssrCode = await fs.readFile(
    path.join(outDir, ssrBundle.fileName),
    "utf8",
  );

  expect(clientCode).toContain('"client"');
  expect(ssrCode).toContain('"server"');
});

test("runs build lifecycle hooks and emits sidecar files", async () => {
  const extraEntry = path.join(fixturesDir, "simple", "src/foo.js");
  const outDir = path.join(outRoot, "plugin-lifecycle");
  const result = await buildFixture("simple", {
    envs: {
      client: { conditions: ["default"], target: "browser" },
      ssr: { conditions: ["node"], target: "node" },
    },
    outputs: { outDir, fileName: "plugin-lifecycle.[env].[hash].js" },
    configPlugins: [
      {
        name: "lifecycle",
        buildStart({ addEntry, emitFile }) {
          addEntry({ id: "extra", path: extraEntry, envs: ["client"] });
          emitFile({
            fileName: "build-start.txt",
            contents: "started",
            type: "manifest",
          });
        },
        beforeCombine: [
          ({ plans }) =>
            plans.map((plan) => ({
              ...plan,
              orderedParts: [
                `const __BEFORE_COMBINE__ = true;`,
                ...plan.orderedParts,
              ],
            })),
        ],
        afterCombine: [({ code }) => `/* after combine */\n${code}`],
        buildEnd({ bundles, emitFile }) {
          emitFile({
            fileName: "summary.json",
            contents: JSON.stringify({ bundles: bundles.length }),
            type: "manifest",
          });
        },
      },
    ],
  });

  const buildStartFile = await fs.readFile(
    path.join(outDir, "build-start.txt"),
    "utf8",
  );
  const summaryFile = await fs.readFile(
    path.join(outDir, "summary.json"),
    "utf8",
  );
  const clientBundles = result.bundles.filter(
    (bundle) => bundle.envId === "client",
  );
  const extraBundle = clientBundles.find(
    (bundle) => bundle.entryId === extraEntry,
  );
  const firstBundleCode = await fs.readFile(
    path.join(outDir, result.bundles[0].fileName),
    "utf8",
  );

  expect(buildStartFile).toBe("started");
  expect(JSON.parse(summaryFile)).toEqual({ bundles: result.bundles.length });
  expect(extraBundle).toBeDefined();
  expect(
    result.bundles.some(
      (bundle) => bundle.envId === "ssr" && bundle.entryId === extraEntry,
    ),
  ).toBe(false);
  expect(firstBundleCode).toContain("/* after combine */");
  expect(firstBundleCode).toContain("const __BEFORE_COMBINE__ = true;");
  expect(result.manifest.emittedFiles.map((file) => file.fileName)).toEqual(
    expect.arrayContaining(["build-start.txt", "summary.json"]),
  );
});

test("executes dynamically imported bundles with the expected exports", async () => {
  const entryPath = path.join(fixturesDir, "dynamic-import", "src/index.js");
  const result = await buildFixture("dynamic-import");
  const bundleDir = path.join(outRoot, "dynamic-import");
  const entryBundle = result.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );

  expect(entryBundle).toBeDefined();

  const bundleUrl = pathToFileURL(
    path.join(bundleDir, entryBundle.fileName),
  ).href;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const mod = await import(${JSON.stringify(bundleUrl)}); console.log(await mod.loadFoo());`,
  ]);

  expect(stdout.trim()).toBe("42");
});
