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
      cache: options.cache,
      css: options.css,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: options.configPlugins ?? [],
      dev: options.dev,
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
let kftqz1jg_feature;
/////##CONDITION_START##"EXPERIMENT_A"
kftqz1jg_feature = ka1gyw5b_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_A"}
kftqz1jg_feature = undefined;
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
let pvain3vm_feature;
/////##CONDITION_START##"EXPERIMENT_B"
pvain3vm_feature = a57bqmm6a_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_B"}
pvain3vm_feature = qb58dser_feature;
/////##CONDITION_END##
const pvain3vm_value = pvain3vm_feature;
export { pvain3vm_value as value };",
}
`);
});

test("records condition metadata in the bundle manifest", async () => {
  const result = await buildFixture("conditional");
  const bundle = result.manifest.bundles[0];
  const conditionMetadata =
    result.manifest.metadata.conditions.byBundle[
      `${bundle.envId}:${bundle.entryId}`
    ];

  expect(bundle.conditionNames).toEqual(["EXPERIMENT_A"]);
  expect(conditionMetadata.conditionNames).toEqual(["EXPERIMENT_A"]);
  expect(conditionMetadata.modules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ condition: "EXPERIMENT_A" }),
    ]),
  );
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
let sa8r0y59_helper;
/////##CONDITION_START##"COND_B"
sa8r0y59_helper = rw4545i1_helper;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_B"}
sa8r0y59_helper = pm2t2idw_helper;
/////##CONDITION_END##
const sa8r0y59_feature = sa8r0y59_helper;
/////##CONDITION_END##
let a2u80kk0g_feature;
/////##CONDITION_START##"COND_A"
a2u80kk0g_feature = sa8r0y59_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
a2u80kk0g_feature = undefined;
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

test("extracts shared modules and entrypoint dependencies without duplication", async () => {
  const projectDir = path.join(outRoot, "shared-chunk-ownership");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await fs.writeFile(
    path.join(srcDir, "shared.js"),
    `globalThis.__SHARED_EVALUATIONS__ = (globalThis.__SHARED_EVALUATIONS__ ?? 0) + 1;
export const shared = 10;`,
  );
  await fs.writeFile(
    path.join(srcDir, "b.js"),
    `import { shared } from "./shared.js";
export const b = shared + 1;`,
  );
  await fs.writeFile(
    path.join(srcDir, "a.js"),
    `import { b } from "./b.js";
import { shared } from "./shared.js";
export const a = b + shared;`,
  );
  await fs.writeFile(
    path.join(srcDir, "c.js"),
    `import { shared } from "./shared.js";
export const c = shared + 2;`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const entryPaths = Object.fromEntries(
    ["a", "b", "c"].map((name) => [name, path.join(srcDir, `${name}.js`)]),
  );
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: Object.values(entryPaths).map((entryPath) => ({
        id: entryPath,
        path: entryPath,
      })),
      outputs: {
        outDir,
        fileName: "[entry].[env].[hash].js",
      },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );

  const commonBundle = result.bundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:common:"),
  );
  const bundlesByEntry = Object.fromEntries(
    Object.entries(entryPaths).map(([name, entryPath]) => [
      name,
      result.bundles.find((bundle) => bundle.entryId === entryPath),
    ]),
  );
  expect(result.bundles).toHaveLength(4);
  expect(commonBundle).toBeDefined();
  expect(Object.values(bundlesByEntry).every(Boolean)).toBe(true);

  const moduleCounts = new Map();
  for (const bundle of result.manifest.bundles) {
    for (const moduleId of bundle.modules) {
      moduleCounts.set(moduleId, (moduleCounts.get(moduleId) ?? 0) + 1);
    }
  }
  expect(
    [path.join(srcDir, "shared.js"), ...Object.values(entryPaths)].map(
      (moduleId) => moduleCounts.get(moduleId),
    ),
  ).toEqual([1, 1, 1, 1]);
  expect(commonBundle.entryId).toBe("bundler:common:browser");
  expect(
    result.manifest.bundles.find(
      (bundle) => bundle.entryId === commonBundle.entryId,
    ).modules,
  ).toEqual([path.join(srcDir, "shared.js")]);

  const [aCode, bCode, cCode, commonCode] = await Promise.all([
    fs.readFile(path.join(outDir, bundlesByEntry.a.fileName), "utf8"),
    fs.readFile(path.join(outDir, bundlesByEntry.b.fileName), "utf8"),
    fs.readFile(path.join(outDir, bundlesByEntry.c.fileName), "utf8"),
    fs.readFile(path.join(outDir, commonBundle.fileName), "utf8"),
  ]);
  expect(aCode).toContain(`from "./${bundlesByEntry.b.fileName}"`);
  expect(aCode).toContain(`from "./${commonBundle.fileName}"`);
  expect(bCode).toContain(`from "./${commonBundle.fileName}"`);
  expect(cCode).toContain(`from "./${commonBundle.fileName}"`);
  expect(
    [aCode, bCode, cCode, commonCode].filter((code) =>
      code.includes("__SHARED_EVALUATIONS__"),
    ),
  ).toHaveLength(1);

  delete globalThis.__SHARED_EVALUATIONS__;
  const [aModule, bModule, cModule] = await Promise.all([
    import(pathToFileURL(path.join(outDir, bundlesByEntry.a.fileName)).href),
    import(pathToFileURL(path.join(outDir, bundlesByEntry.b.fileName)).href),
    import(pathToFileURL(path.join(outDir, bundlesByEntry.c.fileName)).href),
  ]);
  expect({ a: aModule.a, b: bModule.b, c: cModule.c }).toEqual({
    a: 21,
    b: 11,
    c: 12,
  });
  expect(globalThis.__SHARED_EVALUATIONS__).toBe(1);
  delete globalThis.__SHARED_EVALUATIONS__;
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
    await findModuleCacheSuffix(path.join(activeRoot, "files", entryFileHash)),
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

async function findModuleCacheSuffix(moduleRoot) {
  const direct = path.join(moduleRoot, "module.json");
  try {
    await fs.stat(direct);
    return "module.json";
  } catch {
    const entries = await fs.readdir(moduleRoot, { withFileTypes: true });
    const envDir = entries.find((entry) => entry.isDirectory());
    if (!envDir) {
      throw new Error(`Missing module cache under ${moduleRoot}`);
    }
    return path.join(envDir.name, "module.json");
  }
}

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

test("uses different config roots for development and production modes", async () => {
  const cacheDir = path.join(cacheRoot, "mode-roots");
  await fs.rm(cacheDir, { recursive: true, force: true });

  const previousMode = process.env.BUNDLER_MODE;
  try {
    process.env.BUNDLER_MODE = "development";
    await buildFixture("simple", { cacheDir });
    process.env.BUNDLER_MODE = "production";
    await buildFixture("simple", { cacheDir });
  } finally {
    if (previousMode == null) {
      delete process.env.BUNDLER_MODE;
    } else {
      process.env.BUNDLER_MODE = previousMode;
    }
  }

  const v2Dir = path.join(cacheDir, "v2");
  const configRoots = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  expect(configRoots).toHaveLength(2);
});

test("materializes worker artifacts from a remote cache hit", async () => {
  const cacheDir = path.join(cacheRoot, "remote-cache-local");
  const remoteDir = path.join(cacheRoot, "remote-cache-store");
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/throw-on-env-plugin.mjs",
  );
  const cache = {
    local: { dir: cacheDir },
    remote: { kind: "file", dir: remoteDir, prefix: "test" },
  };
  await fs.rm(cacheDir, { recursive: true, force: true });
  await fs.rm(remoteDir, { recursive: true, force: true });

  const first = await buildFixture("simple", {
    cacheDir,
    cache,
    configPlugins: [{ __bundlerPluginRef: true, module: pluginModule }],
  });
  await fs.rm(cacheDir, { recursive: true, force: true });

  process.env.BUNDLER_THROW_TRANSFORM = "1";
  try {
    const second = await buildFixture("simple", {
      cacheDir,
      cache,
      configPlugins: [{ __bundlerPluginRef: true, module: pluginModule }],
    });
    expect(second.bundles[0].fileName).toBe(first.bundles[0].fileName);
  } finally {
    delete process.env.BUNDLER_THROW_TRANSFORM;
  }

  const localRoots = await fs.readdir(path.join(cacheDir, "v2"));
  expect(localRoots.length).toBeGreaterThan(0);
});

test("writes bundle manifest and supports entry output placeholder", async () => {
  const outDir = path.join(outRoot, "entry-placeholder");
  const result = await buildFixture("simple", {
    outputs: {
      outDir,
      fileName: "[entry].[env].[hash].js",
      manifestFile: "manifest.json",
    },
  });

  expect(result.bundles[0].fileName).toMatch(/^index\.browser\.[a-z0-9]+\.js$/);
  const manifest = JSON.parse(
    await fs.readFile(path.join(outDir, "manifest.json"), "utf8"),
  );
  expect(manifest.bundles[0].fileName).toBe(result.bundles[0].fileName);
});

test("extracts CSS and rewrites CSS module imports", async () => {
  const result = await buildFixture("css-basic", {
    outputs: {
      outDir: path.join(outRoot, "css-basic"),
      fileName: "css-basic.[env].[hash].js",
    },
  });
  const styleAssets = result.manifest.assets.filter(
    (asset) => asset.type === "style",
  );
  expect(styleAssets).toHaveLength(1);
  expect(styleAssets[0]).toMatchObject({
    contentType: "text/css; charset=utf-8",
    bundleKey: `${result.bundles[0].envId}:${result.bundles[0].entryId}`,
  });

  const css = await fs.readFile(
    path.join(outRoot, "css-basic", styleAssets[0].fileName),
    "utf8",
  );
  expect(css).toContain("body");
  expect(css).toContain("color: red");

  const bundleUrl = pathToFileURL(
    path.join(outRoot, "css-basic", result.bundles[0].fileName),
  ).href;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const mod = await import(${JSON.stringify(bundleUrl)}); console.log(JSON.stringify({ className: mod.className, noCollision: mod.noCollision }));`,
  ]);
  const mod = JSON.parse(stdout);
  const [defaultClass, namedClass, namespaceClass] = mod.className.split(":");
  expect(defaultClass).toBe(namespaceClass);
  expect(namedClass).toContain("button");
  expect(mod.noCollision).toBe(true);
});

test("dev hmr emits mutable cell installers keyed by identifiers", async () => {
  const result = await buildFixture("simple", {
    outputs: {
      outDir: path.join(outRoot, "simple-hmr"),
      fileName: "simple-hmr.[env].[hash].js",
    },
    dev: { hmr: true, reactRefresh: false },
  });
  const bundlePath = path.join(
    outRoot,
    "simple-hmr",
    result.bundles[0].fileName,
  );
  const output = await fs.readFile(bundlePath, "utf8");
  const hmrBundle =
    result.manifest.metadata.hmr.bundles[
      `${result.bundles[0].envId}:${result.bundles[0].entryId}`
    ];
  const symbolCell = hmrBundle.cells.find((cell) => cell.symbols.length > 0);

  expect(output).toContain("const __BUNDLER_HMR__");
  expect(output).toContain("__BUNDLER_HMR__.register");
  expect(output).toContain('message.type === "rsc-refresh"');
  expect(output).toContain('"bundler:rsc-refresh"');
  expect(output).toContain("let a33jpi1jb_value");
  expect(output).toContain("a33jpi1jb_value = k7isotkd_foo + 1;");
  expect(hmrBundle.reactRefresh).toBe(false);
  expect(symbolCell.symbols.length).toBeGreaterThan(0);
  expect(Object.prototype.hasOwnProperty.call(symbolCell, "moduleId")).toBe(
    false,
  );
  expect(Object.prototype.hasOwnProperty.call(symbolCell, "cellId")).toBe(
    false,
  );
});

test("dev hmr enables react refresh only when react is declared", async () => {
  const projectDir = path.join(outRoot, "react-detect");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ dependencies: { react: "19.0.0" } }),
  );
  await fs.writeFile(
    path.join(srcDir, "index.jsx"),
    `export function App() { return <div />; }`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "react-entry", path: path.join(srcDir, "index.jsx") }],
      outputs: { outDir, fileName: "react-entry.[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 1,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: true },
    },
    [],
  );

  expect(
    result.manifest.metadata.hmr.bundles[
      `${result.bundles[0].envId}:${result.bundles[0].entryId}`
    ].reactRefresh,
  ).toBe(true);
});

test("dev hmr emits dependency cells before dependent cells", async () => {
  const projectDir = path.join(outRoot, "hmr-cell-order");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `export const value = helper();
function helper() {
  return 1;
}`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "hmr-cell-order", path: path.join(srcDir, "index.js") }],
      outputs: { outDir, fileName: "hmr-cell-order.[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 1,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: false },
    },
    [],
  );
  const output = await fs.readFile(
    path.join(outDir, result.bundles[0].fileName),
    "utf8",
  );
  const helperIndex = output.indexOf('_helper"');
  const valueIndex = output.indexOf('_value"');

  expect(helperIndex).toBeGreaterThan(-1);
  expect(valueIndex).toBeGreaterThan(-1);
  expect(helperIndex).toBeLessThan(valueIndex);
});

test("dev react refresh only registers selected component exports", async () => {
  const projectDir = path.join(outRoot, "react-refresh-selected");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ dependencies: { react: "19.0.0" } }),
  );
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import { Used } from "./components.js";
export const value = Used;`,
  );
  await fs.writeFile(
    path.join(srcDir, "components.js"),
    `export function Used() {
  return null;
}
export function Unused() {
  return null;
}`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [
        { id: "react-refresh-selected", path: path.join(srcDir, "index.js") },
      ],
      outputs: { outDir, fileName: "react-refresh-selected.[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 1,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: true },
    },
    [],
  );
  const output = await fs.readFile(
    path.join(outDir, result.bundles[0].fileName),
    "utf8",
  );
  const hmrBundle =
    result.manifest.metadata.hmr.bundles[
      `${result.bundles[0].envId}:${result.bundles[0].entryId}`
    ];
  const usedCell = hmrBundle.cells.find((cell) =>
    cell.symbols.some((symbol) => symbol.endsWith("_Used")),
  );

  expect(output).toContain("_Used");
  expect(output).toContain("reactRefreshRegister");
  expect(output).not.toContain("_Unused");
  expect(usedCell).toBeDefined();
  expect(usedCell.code).toContain("reactRefreshRegister");
});

test("cli loads async config files", async () => {
  const projectDir = path.join(outRoot, "cli-config");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "bundler.config.mjs"),
    `export default async function config() {
      return {
        envs: { browser: { conditions: ["default"], target: "browser" } },
        entries: [{ id: "cli", path: ${JSON.stringify(path.join(fixturesDir, "simple", "src/index.js"))} }],
        outputs: { outDir: ${JSON.stringify(outDir)}, fileName: "cli.[env].[hash].js", manifestFile: "manifest.json" },
        cacheDir: ${JSON.stringify(path.join(projectDir, ".cache"))},
        maxWorkers: 1,
        diagnostics: "human"
      };
    }`,
  );

  const previousCwd = process.cwd();
  const { runCli } = await import("../dist/cli.js");
  try {
    process.chdir(projectDir);
    await runCli(["node", "bundler", "build"]);
  } finally {
    process.chdir(previousCwd);
  }

  const manifest = JSON.parse(
    await fs.readFile(path.join(outDir, "manifest.json"), "utf8"),
  );
  expect(manifest.bundles[0].fileName).toMatch(/^cli\.browser\.[a-z0-9]+\.js$/);
});

test("cli honors explicit config path", async () => {
  const projectDir = path.join(outRoot, "cli-explicit-config");
  const outDir = path.join(projectDir, "dist");
  const configPath = path.join(projectDir, "custom.config.mjs");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(
    configPath,
    `export default {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "cli-explicit", path: ${JSON.stringify(path.join(fixturesDir, "simple", "src/index.js"))} }],
      outputs: { outDir: ${JSON.stringify(outDir)}, fileName: "explicit.[env].[hash].js", manifestFile: "manifest.json" },
      cacheDir: ${JSON.stringify(path.join(projectDir, ".cache"))},
      maxWorkers: 1,
      diagnostics: "human"
    };`,
  );

  const { runCli } = await import("../dist/cli.js");
  await runCli(["node", "bundler", "build", "--config", configPath]);

  const manifest = JSON.parse(
    await fs.readFile(path.join(outDir, "manifest.json"), "utf8"),
  );
  expect(manifest.bundles[0].fileName).toMatch(
    /^explicit\.browser\.[a-z0-9]+\.js$/,
  );
});

test("requires cache directives for inline config functions", async () => {
  await expect(
    buildFixture("simple", {
      configPlugins: [
        {
          name: "missing-cache-directive",
          buildStart() {},
        },
      ],
    }),
  ).rejects.toThrow("Inline config/plugin functions must start");
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
          ssr: async ({ request }) => {
            "externalize-foo-v1";
            return request === "./foo.js" ? null : undefined;
          },
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
  expect(ssrCode).toContain('import { foo as a33jpi1jb_foo } from "./foo.js";');
  expect(ssrCode).toContain("globalThis.__SIDE_EFFECT__ = true;");
});

test("default resolver honors package exports and tsconfig paths aliases", async () => {
  const projectDir = path.join(outRoot, "resolver-aliases");
  const srcDir = path.join(projectDir, "src");
  const pkgDir = path.join(projectDir, "node_modules", "conditional-pkg");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(path.join(srcDir, "alias"), { recursive: true });
  await fs.mkdir(pkgDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@alias/*": ["src/alias/*"],
        },
      },
    }),
  );
  await fs.writeFile(
    path.join(pkgDir, "package.json"),
    JSON.stringify({
      name: "conditional-pkg",
      type: "module",
      exports: {
        ".": {
          browser: "./browser.js",
          node: "./node.js",
          default: "./default.js",
        },
      },
    }),
  );
  await fs.writeFile(
    path.join(pkgDir, "browser.js"),
    `export const value = "browser";`,
  );
  await fs.writeFile(
    path.join(pkgDir, "node.js"),
    `export const value = "node";`,
  );
  await fs.writeFile(
    path.join(pkgDir, "default.js"),
    `export const value = "default";`,
  );
  await fs.writeFile(
    path.join(srcDir, "alias", "value.js"),
    `export const alias = "paths";`,
  );
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import { value } from "conditional-pkg";
import { alias } from "@alias/value";
export const result = value + ":" + alias;`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: {
        browser: { conditions: ["browser"], target: "browser" },
        node: { conditions: ["node"], target: "node" },
      },
      entries: [
        { id: "resolver-aliases", path: path.join(srcDir, "index.js") },
      ],
      outputs: { outDir, fileName: "resolver-aliases.[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );

  const browserBundle = result.bundles.find(
    (bundle) => bundle.envId === "browser",
  );
  const nodeBundle = result.bundles.find((bundle) => bundle.envId === "node");
  const browserOutput = await fs.readFile(
    path.join(outDir, browserBundle.fileName),
    "utf8",
  );
  const nodeOutput = await fs.readFile(
    path.join(outDir, nodeBundle.fileName),
    "utf8",
  );

  expect(browserOutput).toContain('"browser"');
  expect(browserOutput).toContain('"paths"');
  expect(nodeOutput).toContain('"node"');
  expect(nodeOutput).toContain('"paths"');
});

test("cache identity changes when resolver aliases change", async () => {
  const projectDir = path.join(outRoot, "resolver-alias-cache");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const cacheDir = path.join(projectDir, ".cache");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(path.join(srcDir, "one"), { recursive: true });
  await fs.mkdir(path.join(srcDir, "two"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "one", "value.js"),
    `export const value = "one";`,
  );
  await fs.writeFile(
    path.join(srcDir, "two", "value.js"),
    `export const value = "two";`,
  );
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import { value } from "@alias/value";
export const result = value;`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const build = async (target) => {
    await fs.writeFile(
      path.join(projectDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@alias/*": [`src/${target}/*`],
          },
        },
      }),
    );
    return buildProject(
      {
        envs: { browser: { conditions: ["browser"], target: "browser" } },
        entries: [
          { id: "resolver-alias-cache", path: path.join(srcDir, "index.js") },
        ],
        outputs: { outDir, fileName: "resolver-alias-cache.[env].[hash].js" },
        cacheDir,
        maxWorkers: 1,
        diagnostics: "human",
      },
      [],
    );
  };

  await build("one");
  await build("two");

  const roots = (
    await fs.readdir(path.join(cacheDir, "v2"), { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(roots).toHaveLength(2);
});

test("renames external import locals across concatenated and dynamic modules", async () => {
  const projectDir = path.join(outRoot, "external-local-collisions");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(path.join(projectDir, "node_modules/react"), {
    recursive: true,
  });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await fs.writeFile(
    path.join(projectDir, "node_modules/react/package.json"),
    JSON.stringify({ type: "module", exports: "./index.js" }),
  );
  await fs.writeFile(
    path.join(projectDir, "node_modules/react/index.js"),
    `export default { Fragment: "fragment", createElement() {} };
export const Fragment = "fragment";
export function useMemo(callback) { return callback(); }`,
  );
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import { a } from "./a.js";
import { b } from "./b.js";
import { c } from "./c.js";
import { d } from "./d.js";
export const summary = [a, b, c, d].join("|");
export async function loadDyn() {
  return import("./dyn.js");
}`,
  );
  await fs.writeFile(
    path.join(srcDir, "a.js"),
    `import React from "react";
export const a = React.Fragment ? "a" : "missing";`,
  );
  await fs.writeFile(
    path.join(srcDir, "b.js"),
    `import React from "react";
export const b = React.Fragment ? "b" : "missing";`,
  );
  await fs.writeFile(
    path.join(srcDir, "c.js"),
    `import fs, { existsSync } from "node:fs";
export const c = typeof fs.readFileSync + ":" + typeof existsSync;`,
  );
  await fs.writeFile(
    path.join(srcDir, "d.js"),
    `import { existsSync } from "node:fs";
export const d = typeof existsSync;`,
  );
  await fs.writeFile(
    path.join(srcDir, "dyn.js"),
    `import React from "react";
import fs, { existsSync } from "node:fs";
export const dyn = React.Fragment && typeof fs.readFileSync === "function" && existsSync ? "dyn" : "missing";`,
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { node: { conditions: ["node"], target: "node" } },
      entries: [
        { id: "external-collisions", path: path.join(srcDir, "index.js") },
      ],
      outputs: {
        outDir,
        fileName: "[entry].[env].[hash].js",
      },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          name: "externalize-test-imports",
          resolveImport: async ({ request }) => {
            "externalize-test-imports-v1";
            return request === "react" || request === "node:fs"
              ? null
              : undefined;
          },
        },
      ],
    },
    [],
  );
  const entryBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("index.js"),
  );
  const dynamicBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("dyn.js"),
  );
  const entryCode = await fs.readFile(
    path.join(outDir, entryBundle.fileName),
    "utf8",
  );
  const dynamicCode = await fs.readFile(
    path.join(outDir, dynamicBundle.fileName),
    "utf8",
  );

  expect(entryCode.match(/import [a-z0-9]+_React from "react";/g)).toHaveLength(
    2,
  );
  expect(entryCode).toMatch(
    /import [a-z0-9]+_fs, \{ existsSync as [a-z0-9]+_existsSync \} from "node:fs";/,
  );
  expect(entryCode).toMatch(
    /import \{ existsSync as [a-z0-9]+_existsSync \} from "node:fs";/,
  );
  expect(dynamicCode).toMatch(/import [a-z0-9]+_React from "react";/);
  expect(dynamicCode).toMatch(
    /import [a-z0-9]+_fs, \{ existsSync as [a-z0-9]+_existsSync \} from "node:fs";/,
  );

  const imported = await import(
    pathToFileURL(path.join(outDir, entryBundle.fileName))
  );
  expect(imported.summary).toBe("a|b|function:function|function");
  await expect(imported.loadDyn()).resolves.toMatchObject({ dyn: "dyn" });
});

test("supports virtual modules through resolveImport and load", async () => {
  const fixtureName = "plugin-virtual";
  const virtualPath = path.join(outRoot, ".virtual", "virtual-msg.js");
  const cacheDir = path.join(cacheRoot, fixtureName);
  await fs.rm(cacheDir, { recursive: true, force: true });
  const result = await buildFixture(fixtureName, {
    cacheDir,
    configPlugins: [
      {
        name: "virtual-msg",
        resolveImport: async ({ request }) => {
          "virtual-resolve-v1";
          return request === "virtual:msg"
            ? { id: "virtual:msg", filePath: virtualPath, virtual: true }
            : undefined;
        },
        load: async ({ id }) => {
          "virtual-load-v1";
          return id === "virtual:msg"
            ? { code: 'export const msg = "hello from virtual";' }
            : undefined;
        },
      },
    ],
  });

  const output = await readBundle(result, fixtureName);
  expect(output).toContain('"hello from virtual"');
  expect(output).toContain("export {");

  const v2Dir = path.join(cacheDir, "v2");
  const configRoots = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(configRoots).toHaveLength(1);
  const activeRoot = path.join(v2Dir, configRoots[0]);
  const virtualFileHash = contentHash(normalizePosixPath(virtualPath));
  const moduleRoot = path.join(activeRoot, "files", virtualFileHash);
  const moduleJson = JSON.parse(
    await fs.readFile(
      path.join(moduleRoot, await findModuleCacheSuffix(moduleRoot)),
      "utf8",
    ),
  );
  const fileRecord =
    moduleJson.fileRecordsByEnv?.browser ??
    moduleJson.fileRecordsByEnv?.default ??
    moduleJson.fileRecord;
  expect(fileRecord.filePath).toBe(path.resolve(virtualPath));
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

test("resolves imports introduced by transform plugins", async () => {
  const projectDir = path.join(outRoot, "introduced-transform-import");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    "export const value = injected + 1;",
  );
  await fs.writeFile(
    path.join(srcDir, "dependency.js"),
    "export const injected = 41;",
  );

  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/introduced-import-plugin.mjs",
  );
  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "index", path: path.join(srcDir, "index.js") }],
      outputs: { outDir, fileName: "[entry].[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [{ __bundlerPluginRef: true, module: pluginModule }],
    },
    [],
  );

  expect(result.manifest.bundles[0].modules).toEqual(
    expect.arrayContaining([
      path.join(srcDir, "index.js"),
      path.join(srcDir, "dependency.js"),
    ]),
  );
  const bundleUrl = new URL(
    result.bundles[0].fileName,
    pathToFileURL(`${outDir}${path.sep}`),
  );
  await expect(import(bundleUrl.href)).resolves.toMatchObject({ value: 42 });
});

test("caches extra transform outputs and exposes them to build plugins", async () => {
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/metadata-output-plugin.mjs",
  );
  const outDir = path.join(outRoot, "extra-output-plugin");
  await buildFixture("simple", {
    outputs: {
      outDir,
      fileName: "extra-output.[env].[hash].js",
    },
    configPlugins: [{ __bundlerPluginRef: true, module: pluginModule }],
  });

  const emitted = JSON.parse(
    await fs.readFile(path.join(outDir, "extra-outputs.json"), "utf8"),
  );
  expect(emitted).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "test-metadata",
        file: path.join(fixturesDir, "simple", "src/index.js"),
      }),
    ]),
  );
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
          "lifecycle-build-start-v1";
          addEntry({ id: "extra", path: extraEntry, envs: ["client"] });
          emitFile({
            fileName: "build-start.txt",
            contents: "started",
            type: "manifest",
          });
        },
        beforeCombine: [
          ({ plans }) => {
            "lifecycle-before-combine-v1";
            return plans.map((plan) => ({
              ...plan,
              orderedParts: [
                `const __BEFORE_COMBINE__ = true;`,
                ...plan.orderedParts,
              ],
            }));
          },
        ],
        afterCombine: [
          ({ code }) => {
            "lifecycle-after-combine-v1";
            return `/* after combine */\n${code}`;
          },
        ],
        buildEnd({ bundles, emitFile }) {
          "lifecycle-build-end-v1";
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
