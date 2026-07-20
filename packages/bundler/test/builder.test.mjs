import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { jest } from "@jest/globals";
import {
  contentHash,
  findPkgRoot,
  packagePathIdentity,
  readPkgSafe,
} from "@bundler/shared";
import { materializeHmrPatch } from "../dist/dev/hmr-linker.js";
import { withTestConfig } from "./test-config.mjs";

const rootDir = path.resolve(process.cwd());
const fixturesDir = path.join(rootDir, "test/fixtures");
const outRoot = path.join(rootDir, "test/.out");
const cacheRoot = path.join(rootDir, "tmp/test-cache");
const execFileAsync = promisify(execFile);

jest.setTimeout(15_000);

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
      transforms: options.transforms,
      environmentVariables: options.environmentVariables,
      maxWorkers: 2,
      diagnostics: "human",
      debug: options.debug,
      plugins: options.configPlugins ?? [],
      dev: options.dev,
    },
    options.plugins ?? [],
  );
}

test("rejects arbitrary per-file CSS transform options", async () => {
  await expect(
    buildFixture("simple", {
      transforms: { css: { minify: true } },
    }),
  ).rejects.toThrow("transforms.css must be exactly 'lightningcss' or false");
});

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

function stripEnvironmentIdentity(moduleId) {
  return moduleId.replace(/::environment=[^:]+$/, "");
}

function moduleIdForFile(moduleIds, filePath) {
  const fileName = path.basename(filePath);
  return Array.from(moduleIds).find((moduleId) =>
    stripEnvironmentIdentity(moduleId).endsWith(fileName),
  );
}

test("bundles simple module graph", async () => {
  const snapshot = await snapshotFixture("simple");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "simple",
  "output": "
globalThis.__SIDE_EFFECT__ = true;
const c0ha17fb_foo = 2;
const hf46egd0_value = c0ha17fb_foo + 1;
export { hf46egd0_value as value };",
}
`);
});

test("never creates more transform workers than maxWorkers", async () => {
  const projectDir = path.join(outRoot, "max-workers-cap");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const entryPaths = Array.from({ length: 4 }, (_, index) =>
    path.join(srcDir, `entry-${index}.js`),
  );
  await Promise.all(
    entryPaths.map((entryPath, index) =>
      fs.writeFile(entryPath, `export const value = ${index};`),
    ),
  );
  const transformedEntries = new Map();
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await buildProject(
    {
      targets: { browser: { platform: "browser" } },
      environments: { app: {} },
      entries: entryPaths.map((entryPath) => ({
        path: entryPath,
        environment: "app",
        targets: ["browser"],
      })),
      outputs: { outDir, fileName: "[entry].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 1,
      diagnostics: "human",
      plugins: [
        {
          __bundlerPluginRef: true,
          module: path.join(
            rootDir,
            "packages/bundler/test/plugins/worker-thread-metadata-plugin.mjs",
          ),
        },
      ],
    },
    [
      {
        name: "capture-transform-worker-threads",
        buildEnd({ modules }) {
          "capture-transform-worker-threads-v1";
          for (const module of modules) {
            const metadata =
              module.extraOutputs?.["test-worker-thread"]?.metadata;
            if (
              entryPaths.includes(module.filePath) &&
              metadata &&
              typeof metadata.threadId === "number"
            ) {
              transformedEntries.set(module.filePath, metadata.threadId);
            }
          }
        },
      },
    ],
  );

  expect(Array.from(transformedEntries.keys()).sort()).toEqual(
    [...entryPaths].sort(),
  );
  expect(new Set(transformedEntries.values()).size).toBe(1);
});

test("does not resolve an import again after worker-coordinator discovery", async () => {
  const projectDir = path.join(outRoot, "single-resolution-per-edge");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import { dependency } from "./dependency.js"; export const value = dependency;`,
  );
  await fs.writeFile(
    path.join(srcDir, "dependency.js"),
    `export const dependency = 1;`,
  );
  let resolutions = 0;
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await buildProject(
    {
      targets: { browser: { platform: "browser" } },
      environments: { app: {} },
      entries: [
        {
          path: path.join(srcDir, "index.js"),
          environment: "app",
          targets: ["browser"],
        },
      ],
      outputs: { outDir, fileName: "[entry].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [
      {
        name: "count-resolutions",
        async resolveImport(context) {
          "count-resolutions-v1";
          if (context.request === "./dependency.js") resolutions += 1;
          return context.resolveDefault();
        },
      },
    ],
  );

  expect(resolutions).toBe(1);
});

test("adds conditional markers", async () => {
  const snapshot = await snapshotFixture("conditional");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "conditional",
  "output": "
/////##CONDITION_START##"EXPERIMENT_A"
const dbs9ft2q_feature = "enabled";
/////##CONDITION_END##
let c8k0odoj_feature;
/////##CONDITION_START##"EXPERIMENT_A"
c8k0odoj_feature = dbs9ft2q_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_A"}
c8k0odoj_feature = undefined;
/////##CONDITION_END##
const c8k0odoj_value = c8k0odoj_feature;
export { c8k0odoj_value as value };",
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
const ah2zpfxw_feature = "yes";
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_B"}
const qlhwyog2_feature = "no";
/////##CONDITION_END##
let a1iz1zofw_feature;
/////##CONDITION_START##"EXPERIMENT_B"
a1iz1zofw_feature = ah2zpfxw_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"EXPERIMENT_B"}
a1iz1zofw_feature = qlhwyog2_feature;
/////##CONDITION_END##
const a1iz1zofw_value = a1iz1zofw_feature;
export { a1iz1zofw_value as value };",
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
  expect(result.conditionNames).toEqual(["EXPERIMENT_A"]);
  expect(result.manifest.metadata.conditions).toMatchObject({
    fileName: "conditions.json",
    global: ["EXPERIMENT_A"],
  });
  await expect(
    fs.readFile(path.join(outRoot, "conditional", "conditions.json"), "utf8"),
  ).resolves.toBe(JSON.stringify(["EXPERIMENT_A"], null, 2));
  expect(conditionMetadata.conditionNames).toEqual(["EXPERIMENT_A"]);
  expect(conditionMetadata.modules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ condition: "EXPERIMENT_A" }),
    ]),
  );
});

test("emits one sorted and deduplicated condition set for the entire build", async () => {
  const fixtureRoot = path.join(fixturesDir, "global-conditions/src");
  const result = await buildFixture("global-conditions", {
    entries: [
      { id: "a", path: path.join(fixtureRoot, "a.js") },
      { id: "b", path: path.join(fixtureRoot, "b.js") },
    ],
  });
  const expected = ["isChrome", "isFirefox", "isSafari"];

  expect(result.conditionNames).toEqual(expected);
  expect(result.manifest.metadata.conditions.global).toEqual(expected);
  await expect(
    fs.readFile(
      path.join(outRoot, "global-conditions", "conditions.json"),
      "utf8",
    ),
  ).resolves.toBe(JSON.stringify(expected, null, 2));
});

test("build-time environment values select dependencies and invalidate transform caches", async () => {
  const cacheDir = path.join(cacheRoot, "build-condition-shared");
  await fs.rm(cacheDir, { recursive: true, force: true });
  const development = await buildFixture("build-condition", {
    cacheDir,
    environmentVariables: { NODE_ENV: "development" },
  });
  const developmentCode = await readBundle(development, "build-condition");
  const production = await buildFixture("build-condition", {
    cacheDir,
    environmentVariables: { NODE_ENV: "production" },
  });
  const productionCode = await readBundle(production, "build-condition");

  expect(developmentCode).toContain("development build branch");
  expect(developmentCode).not.toContain("production build branch");
  expect(productionCode).toContain("production build branch");
  expect(productionCode).not.toContain("development build branch");
  expect(production.bundles[0].fileName).not.toBe(
    development.bundles[0].fileName,
  );
  expect(development.conditionNames).toEqual([]);
  expect(production.conditionNames).toEqual([]);
});

test("inherits and combines nested conditional imports", async () => {
  const snapshot = await snapshotFixture("inherited-conditional");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "inherited-conditional",
  "output": "
/////##CONDITION_START##{"AND":["COND_A","COND_B"]}
const o7bpz4pq_helper = "helper";
/////##CONDITION_END##
/////##CONDITION_START##{"AND":["COND_A",{"NOT":"COND_B"}]}
const h5i9ubi9_helper = "fallback";
/////##CONDITION_END##
/////##CONDITION_START##"COND_A"
let a8tid8dgi_helper;
/////##CONDITION_START##"COND_B"
a8tid8dgi_helper = o7bpz4pq_helper;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_B"}
a8tid8dgi_helper = h5i9ubi9_helper;
/////##CONDITION_END##
const a8tid8dgi_feature = a8tid8dgi_helper;
/////##CONDITION_END##
let a4e93bg9o_feature;
/////##CONDITION_START##"COND_A"
a4e93bg9o_feature = a8tid8dgi_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
a4e93bg9o_feature = undefined;
/////##CONDITION_END##
function a4e93bg9o_run() {
  return a4e93bg9o_feature;
}
export { a4e93bg9o_run as run };",
}
`);
});

test("emits namespace object for namespace imports", async () => {
  const snapshot = await snapshotFixture("namespace");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "namespace",
  "output": "
const a7m19y90e_answer = 7;
const a7m19y90e_name = "ns";
const __NS__a7m19y90e = Object.create(null);
Object.defineProperty(__NS__a7m19y90e, Symbol.toStringTag, { value: "Module" });
Object.defineProperty(__NS__a7m19y90e, "answer", { enumerable: true, get: () => a7m19y90e_answer });
Object.defineProperty(__NS__a7m19y90e, "name", { enumerable: true, get: () => a7m19y90e_name });
Object.preventExtensions(__NS__a7m19y90e);
const a5cjrrc31_value = __NS__a7m19y90e.answer;
const a5cjrrc31_dynamic = __NS__a7m19y90e["answer"];
export { a5cjrrc31_value as value, a5cjrrc31_dynamic as dynamic };",
}
`);
});

test("handles export star with override", async () => {
  const snapshot = await snapshotFixture("export-star");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "export-star",
  "output": "
const a89f4o6ca_value = "a";
const hwuyj0hx_value = "b";
const qxx4j03t_value = a89f4o6ca_value;
const qxx4j03t_bValue = hwuyj0hx_value;
export { qxx4j03t_value as value, qxx4j03t_bValue as bValue };",
}
`);
});

test("normalizes dynamic imports to dependency URL arrays plus parallel native imports", async () => {
  const snapshot = await snapshotFixture("dynamic-import");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import",
  "output": "const __bundler_ba1ymwhokq_output_url = [new URL("./dynamic-import.browser.cuwbdnum.js", import.meta.url).href];

const ldcpm8z5_default = __bundler_ba1ymwhokq_output_url;
const a3maoz05l__bundler_dynamic_import = () => Promise.all(ldcpm8z5_default.map(_bundler_dynamic_dependency_url => import(_bundler_dynamic_dependency_url))).then(_bundler_dynamic_modules => _bundler_dynamic_modules[0]);
async function a3maoz05l_loadFoo() {
  const mod = await a3maoz05l__bundler_dynamic_import();
  return mod.foo;
}
export { a3maoz05l_loadFoo as loadFoo };",
}
`);
});

test("dedupes generated dynamic dependency URL imports and loaders", async () => {
  const snapshot = await snapshotFixture("dynamic-import-shared");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "dynamic-import-shared",
  "output": "const __bundler_50249w60y7_output_url = [new URL("./dynamic-import-shared.browser.sy8ptlff.js", import.meta.url).href];

const csrplpjq_default = __bundler_50249w60y7_output_url;
const imofsh4g__bundler_dynamic_import = () => Promise.all(csrplpjq_default.map(_bundler_dynamic_dependency_url => import(_bundler_dynamic_dependency_url))).then(_bundler_dynamic_modules => _bundler_dynamic_modules[0]);
async function imofsh4g_loadA() {
  return imofsh4g__bundler_dynamic_import();
}
async function imofsh4g_loadB() {
  return imofsh4g__bundler_dynamic_import();
}
export { imofsh4g_loadA as loadA, imofsh4g_loadB as loadB };",
}
`);
});

test("url_and_deps_array links the target-first transitive script closure", async () => {
  const name = "dependency-url-array";
  const projectDir = path.join(outRoot, name);
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
    `import aUrls from "./a.js" with { as: "url_and_deps_array" };
export const preloadUrls = aUrls;
export const loadA = () => import("./a.js");
export const loadB = () => import("./b.js");`,
  );
  await fs.writeFile(
    path.join(srcDir, "a.js"),
    `import { common } from "./common.js";
export const value = \`a:\${common}\`;`,
  );
  await fs.writeFile(
    path.join(srcDir, "b.js"),
    `import { common } from "./common.js";
export const value = \`b:\${common}\`;`,
  );
  await fs.writeFile(
    path.join(srcDir, "common.js"),
    `import { leaf } from "./leaf.js";
export const common = \`common:\${leaf}\`;`,
  );
  await fs.writeFile(
    path.join(srcDir, "leaf.js"),
    `export const leaf = "leaf";`,
  );

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const config = {
    envs: { browser: { conditions: ["default"], target: "browser" } },
    entries: [{ id: name, path: path.join(srcDir, "index.js") }],
    outputs: { outDir, fileName: "[entry].[env].[hash].js" },
    cacheDir: path.join(projectDir, ".cache"),
    css: false,
    maxWorkers: 2,
    diagnostics: "human",
    plugins: [
      {
        name: "dependency-url-array-chunks",
        manualChunk(module) {
          "dependency-url-array-chunks-v1";
          if (module.filePath.endsWith(`${path.sep}common.js`)) {
            return "common";
          }
          if (module.filePath.endsWith(`${path.sep}leaf.js`)) {
            return "leaf";
          }
          return undefined;
        },
      },
    ],
  };
  const result = await buildProject(config, []);

  const entryBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith(`${path.sep}index.js`),
  );
  const aBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith(`${path.sep}a.js`),
  );
  const bBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith(`${path.sep}b.js`),
  );
  const commonBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith(":common"),
  );
  const leafBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith(":leaf"),
  );
  expect(entryBundle).toBeDefined();
  expect(aBundle).toBeDefined();
  expect(bBundle).toBeDefined();
  expect(commonBundle).toBeDefined();
  expect(leafBundle).toBeDefined();

  const code = await fs.readFile(
    path.join(outDir, entryBundle.fileName),
    "utf8",
  );
  for (const target of [aBundle, bBundle]) {
    const start = code.indexOf(`new URL("./${target.fileName}"`);
    const common = code.indexOf(`new URL("./${commonBundle.fileName}"`, start);
    const leaf = code.indexOf(`new URL("./${leafBundle.fileName}"`, common);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(common).toBeGreaterThan(start);
    expect(leaf).toBeGreaterThan(common);
  }
  expect(code).toContain("Promise.all(");

  const namespace = await import(
    `${pathToFileURL(path.join(outDir, entryBundle.fileName)).href}?closure`
  );
  expect(
    namespace.preloadUrls.map((url) => path.basename(new URL(url).pathname)),
  ).toEqual([aBundle.fileName, commonBundle.fileName, leafBundle.fileName]);
  await expect(namespace.loadA()).resolves.toMatchObject({
    value: "a:common:leaf",
  });
  await expect(namespace.loadB()).resolves.toMatchObject({
    value: "b:common:leaf",
  });

  await fs.writeFile(
    path.join(srcDir, "leaf.js"),
    `export const leaf = "changed";`,
  );
  const rebuilt = await buildProject(config, []);
  const rebuiltEntry = rebuilt.bundles.find((bundle) =>
    bundle.entryId.endsWith(`${path.sep}index.js`),
  );
  const rebuiltLeaf = rebuilt.bundles.find((bundle) =>
    bundle.entryId.endsWith(":leaf"),
  );
  expect(rebuiltEntry.fileName).not.toBe(entryBundle.fileName);
  expect(rebuiltLeaf.fileName).not.toBe(leafBundle.fileName);
  const rebuiltCode = await fs.readFile(
    path.join(outDir, rebuiltEntry.fileName),
    "utf8",
  );
  expect(rebuiltCode).toContain(rebuiltLeaf.fileName);
  expect(rebuiltCode).not.toContain(leafBundle.fileName);
});

test("keeps public and module-relative URL link variants distinct", async () => {
  const projectDir = path.join(outRoot, "url-mode-link-variants");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import relativeUrl from "./child.js" with { as: "url", urlMode: "module-relative" };
import publicUrl from "./child.js" with { as: "url", urlMode: "public" };
export const urls = [relativeUrl, publicUrl];`,
  );
  await fs.writeFile(
    path.join(srcDir, "child.js"),
    `export const child = true;`,
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      targets: { browser: { platform: "browser" } },
      environments: { app: {} },
      entries: [
        {
          path: path.join(srcDir, "index.js"),
          environment: "app",
          targets: ["browser"],
        },
      ],
      outputs: {
        outDir,
        rootURL: "/assets/",
        fileName: "chunks/[entry]/bundle.[hash].js",
      },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );
  const entryBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/index.js"),
  );
  const childBundle = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/child.js"),
  );
  const code = await fs.readFile(
    path.join(outDir, entryBundle.fileName),
    "utf8",
  );
  const relative = path.posix.relative(
    path.posix.dirname(entryBundle.fileName),
    childBundle.fileName,
  );
  const relativeSpecifier = relative.startsWith(".")
    ? relative
    : `./${relative}`;

  expect(code.match(/const __bundler_.*_output_url/g)).toHaveLength(2);
  expect(code).toContain(`new URL(${JSON.stringify(relativeSpecifier)}`);
  expect(code).toContain(JSON.stringify(`/assets/${childBundle.fileName}`));
});

test("rejects url_and_deps_array for non-JavaScript files", async () => {
  const name = "invalid-dependency-url-array";
  const projectDir = path.join(outRoot, name);
  const srcDir = path.join(projectDir, "src");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `import urls from "./value.txt" with { as: "url_and_deps_array" };
export const value = urls;`,
  );
  await fs.writeFile(path.join(srcDir, "value.txt"), "not JavaScript\n");

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await expect(
    buildProject(
      {
        envs: { browser: { conditions: ["default"], target: "browser" } },
        entries: [{ id: name, path: path.join(srcDir, "index.js") }],
        outputs: {
          outDir: path.join(projectDir, "dist"),
          fileName: "[entry].[env].[hash].js",
        },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 1,
        diagnostics: "human",
      },
      [],
    ),
  ).rejects.toThrow("as: 'url_and_deps_array' requires a JavaScript module");
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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
    bundle.entryId.startsWith("bundler:shared:"),
  );
  const bundlesByEntry = Object.fromEntries(
    Object.entries(entryPaths).map(([name, entryPath]) => [
      name,
      result.bundles.find((bundle) => bundle.entryId === entryPath),
    ]),
  );
  expect(result.bundles).toHaveLength(4);
  expect(commonBundle).toBeDefined();
  expect(commonBundle.entryKind).toBe("shared");
  expect(
    result.manifest.dynamicImports[
      `${commonBundle.envId}:${commonBundle.entryId}`
    ],
  ).toBeUndefined();
  expect(Object.values(bundlesByEntry).every(Boolean)).toBe(true);

  const moduleCounts = new Map();
  for (const bundle of result.manifest.bundles) {
    for (const moduleId of bundle.modules) {
      moduleCounts.set(moduleId, (moduleCounts.get(moduleId) ?? 0) + 1);
    }
  }
  expect(
    [path.join(srcDir, "shared.js"), ...Object.values(entryPaths)].map(
      (filePath) =>
        moduleCounts.get(moduleIdForFile(moduleCounts.keys(), filePath)),
    ),
  ).toEqual([1, 1, 1, 1]);
  expect(commonBundle.entryId).toMatch(/^bundler:shared:/);
  expect(
    result.manifest.bundles.find(
      (bundle) => bundle.entryId === commonBundle.entryId,
    ).modules,
  ).toEqual([expect.stringMatching(/[/\\]shared\.js::environment=browser$/)]);

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

test("splits shared chunks when entrypoints require conflicting evaluation order", async () => {
  const projectDir = path.join(outRoot, "shared-evaluation-order");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await fs.writeFile(
    path.join(srcDir, "x.js"),
    `globalThis.__evaluationOrder ??= []; globalThis.__evaluationOrder.push("x");`,
  );
  await fs.writeFile(
    path.join(srcDir, "y.js"),
    `globalThis.__evaluationOrder ??= []; globalThis.__evaluationOrder.push("y");`,
  );
  await fs.writeFile(
    path.join(srcDir, "a.js"),
    `import "./x.js"; import "./y.js"; export const order = globalThis.__evaluationOrder.join("");`,
  );
  await fs.writeFile(
    path.join(srcDir, "b.js"),
    `import "./y.js"; import "./x.js"; export const order = globalThis.__evaluationOrder.join("");`,
  );

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  for (const [mode, platform, chunking] of [
    ["split", "browser", "split"],
    ["single-fallback", "node", "single"],
  ]) {
    const modeOutDir = path.join(outDir, mode);
    const result = await buildProject(
      {
        targets: { target: { platform, chunking } },
        environments: { app: {} },
        entries: ["a", "b"].map((name) => ({
          path: path.join(srcDir, `${name}.js`),
          environment: "app",
          targets: ["target"],
        })),
        outputs: { outDir: modeOutDir, fileName: "[entry].[hash].js" },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
      },
      [],
    );

    expect(
      result.bundles.filter((bundle) =>
        bundle.entryId.startsWith("bundler:shared:"),
      ),
    ).toHaveLength(2);
    for (const [entryName, expected] of [
      ["a.js", "xy"],
      ["b.js", "yx"],
    ]) {
      const bundle = result.bundles.find((candidate) =>
        candidate.entryId.endsWith(entryName),
      );
      const { stdout } = await execFileAsync(process.execPath, [
        "--input-type=module",
        "--eval",
        `globalThis.__evaluationOrder = [];
const result = await import(${JSON.stringify(
          pathToFileURL(path.join(modeOutDir, bundle.fileName)).href,
        )});
console.log(result.order);`,
      ]);
      expect(stdout.trim()).toBe(expected);
    }
  }
});

test("rejects aggregate three-way evaluation cycles in a manual chunk", async () => {
  const projectDir = path.join(outRoot, "manual-three-way-order-cycle");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  for (const name of ["x", "y", "z"]) {
    await fs.writeFile(
      path.join(srcDir, `${name}.js`),
      `globalThis.__${name} = true;`,
    );
  }
  for (const [name, imports] of [
    ["a", ["x", "y"]],
    ["b", ["y", "z"]],
    ["c", ["z", "x"]],
  ]) {
    await fs.writeFile(
      path.join(srcDir, `${name}.js`),
      `${imports.map((dependency) => `import "./${dependency}.js";`).join(" ")}
export const value = ${JSON.stringify(name)};`,
    );
  }

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await expect(
    buildProject(
      {
        targets: { server: { platform: "node", chunking: "single" } },
        environments: { app: {} },
        entries: ["a", "b", "c"].map((name) => ({
          path: path.join(srcDir, `${name}.js`),
          environment: "app",
          targets: ["server"],
        })),
        outputs: { outDir, fileName: "[entry].[hash].js" },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 3,
        diagnostics: "human",
        plugins: [
          {
            name: "three-way-manual-order",
            manualChunk(moduleInfo) {
              "three-way-manual-order-v1";
              return /[/\\](?:x|y|z)\.js$/.test(moduleInfo.filePath)
                ? "ordered"
                : undefined;
            },
          },
        ],
      },
      [],
    ),
  ).rejects.toThrow("incompatible evaluation order");
});

test("uses target chunking policy for ordinary shared modules", async () => {
  const projectDir = path.join(outRoot, "target-chunking-policy");
  const srcDir = path.join(projectDir, "src");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "shared-all.js"),
    `export const sharedAll = 1;`,
  );
  await fs.writeFile(
    path.join(srcDir, "shared-pair.js"),
    `export const sharedPair = 2;`,
  );
  for (const name of ["a", "b", "c"]) {
    await fs.writeFile(
      path.join(srcDir, `${name}.js`),
      `import { sharedAll } from "./shared-all.js";
${name === "c" ? "" : 'import { sharedPair } from "./shared-pair.js";'}
globalThis.__entryEffects ??= [];
globalThis.__entryEffects.push(${JSON.stringify(name)});
export const ${name} = sharedAll${name === "c" ? "" : " + sharedPair"};`,
    );
  }
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const build = (name, platform, chunking) =>
    buildProject(
      {
        targets: { target: { platform, chunking } },
        environments: { app: {} },
        entries: ["a", "b", "c"].map((entryName) => ({
          path: path.join(srcDir, `${entryName}.js`),
          environment: "app",
          targets: ["target"],
        })),
        outputs: {
          outDir: path.join(projectDir, name),
          fileName: "[entry].[target].[hash].js",
        },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
      },
      [],
    );
  const [single, split] = await Promise.all([
    build("single", "node", "single"),
    build("split", "browser", "split"),
  ]);

  expect(single.bundles).toHaveLength(4);
  expect(
    single.bundles.filter((bundle) =>
      bundle.entryId.startsWith("bundler:shared:"),
    ),
  ).toHaveLength(1);
  expect(split.bundles).toHaveLength(5);
  expect(
    split.bundles.filter((bundle) =>
      bundle.entryId.startsWith("bundler:shared:"),
    ),
  ).toHaveLength(2);

  const singleB = single.bundles.find((bundle) =>
    bundle.entryId.endsWith("/b.js"),
  );
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `globalThis.__entryEffects = [];
await import(${JSON.stringify(
      pathToFileURL(path.join(projectDir, "single", singleB.fileName)).href,
    )});
console.log(JSON.stringify(globalThis.__entryEffects));`,
  ]);
  expect(JSON.parse(stdout)).toEqual(["b"]);
});

test("tree-shakes independent static CommonJS exports", async () => {
  const result = await buildFixture("cjs-static-tree-shake", {
    configPlugins: [
      {
        __bundlerPluginRef: true,
        module: path.join(
          rootDir,
          "packages/bundler/test/plugins/cjs-to-esm-plugin.mjs",
        ),
      },
    ],
  });
  const output = await readBundle(result, "cjs-static-tree-shake");

  expect(output).toContain("USED_CJS_MARKER");
  expect(output).not.toContain("UNUSED_CJS_MARKER");
  expect(output).not.toContain("__cjs_require__");
  expect(output).not.toContain("__BUNDLER_CJS_CACHE__");
});

test("keeps reachability-based shared chunks stable in development and production", async () => {
  const projectDir = path.join(outRoot, "consumer-set-boundaries");
  const srcDir = path.join(projectDir, "src");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await Promise.all([
    fs.writeFile(
      path.join(srcDir, "shared-all.js"),
      "export const sharedAll = 10;",
    ),
    fs.writeFile(
      path.join(srcDir, "shared-ab.js"),
      "export const sharedAB = 20;",
    ),
    fs.writeFile(path.join(srcDir, "only-a.js"), "export const onlyA = 1;"),
    fs.writeFile(
      path.join(srcDir, "a.js"),
      `import { sharedAll } from "./shared-all.js";
import { sharedAB } from "./shared-ab.js";
import { onlyA } from "./only-a.js";
export const a = sharedAll + sharedAB + onlyA;`,
    ),
    fs.writeFile(
      path.join(srcDir, "b.js"),
      `import { sharedAll } from "./shared-all.js";
import { sharedAB } from "./shared-ab.js";
export const b = sharedAll + sharedAB;`,
    ),
    fs.writeFile(
      path.join(srcDir, "c.js"),
      `import { sharedAll } from "./shared-all.js";
export const c = sharedAll;`,
    ),
  ]);

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const entries = ["a", "b", "c"].map((name) => ({
    id: name,
    path: path.join(srcDir, `${name}.js`),
  }));
  const build = (mode, dev) =>
    buildProject(
      {
        envs: { browser: { conditions: ["default"], target: "browser" } },
        entries,
        outputs: {
          outDir: path.join(projectDir, mode),
          fileName: "[entry].[env].[hash].js",
        },
        cacheDir: path.join(projectDir, `.cache-${mode}`),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
        dev,
      },
      [],
    );
  const [production, development] = await Promise.all([
    build("production"),
    build("development", { hmr: true, reactRefresh: false }),
  ]);
  const moduleOwners = (result) =>
    Object.fromEntries(
      result.manifest.bundles.flatMap((bundle) =>
        bundle.modules.map((moduleId) => [moduleId, bundle.entryId]),
      ),
    );
  const ownerForFile = (owners, filePath) =>
    owners[moduleIdForFile(Object.keys(owners), filePath)];

  expect(moduleOwners(development)).toEqual(moduleOwners(production));
  expect(production.bundles).toHaveLength(5);
  expect(development.bundles).toHaveLength(6);
  expect(
    production.bundles.filter((bundle) =>
      bundle.entryId.startsWith("bundler:shared:"),
    ),
  ).toHaveLength(2);
  expect(ownerForFile(moduleOwners(production), "shared-all.js")).toMatch(
    /^bundler:shared:/,
  );
  expect(ownerForFile(moduleOwners(production), "shared-ab.js")).toMatch(
    /^bundler:shared:/,
  );
  expect(ownerForFile(moduleOwners(production), "shared-all.js")).not.toBe(
    ownerForFile(moduleOwners(production), "shared-ab.js"),
  );
  expect(ownerForFile(moduleOwners(production), "only-a.js")).toBe(
    path.join(srcDir, "a.js"),
  );

  const developmentOutputs = await Promise.all(
    development.bundles.map(async (bundle) => ({
      bundle,
      code: await fs.readFile(
        path.join(projectDir, "development", bundle.fileName),
        "utf8",
      ),
    })),
  );
  const runtimeOutput = developmentOutputs.find(({ bundle }) =>
    bundle.entryId.startsWith("bundler:hmr-runtime:"),
  );
  expect(runtimeOutput).toBeDefined();
  expect(
    developmentOutputs.filter(({ code }) =>
      code.includes("const __BUNDLER_HMR__"),
    ),
  ).toEqual([runtimeOutput]);
  for (const { bundle, code } of developmentOutputs) {
    if (bundle === runtimeOutput.bundle) {
      continue;
    }
    expect(code).toContain(`from "./${runtimeOutput.bundle.fileName}";`);
  }
});

test("rewrites import.meta url", async () => {
  const snapshot = await snapshotFixture("import-meta");
  expect(snapshot).toMatchInlineSnapshot(`
{
  "name": "import-meta",
  "output": "const __bundler_enw8tn3k7w_output_url = "/assets/asset.awn9r5lu.svg";

const a836grn9l_default = __bundler_enw8tn3k7w_output_url;
const mwpgj9kz_asset = new URL(a836grn9l_default, import.meta.url).href;
export { mwpgj9kz_asset as asset };",
}
`);
});

test("builds HTML entries with scripts, styles, and assets", async () => {
  const name = "html-entry";
  const htmlPath = path.join(fixturesDir, name, "index.html");
  const result = await buildFixture(name, {
    entries: [{ id: "index", path: htmlPath, kind: "html" }],
    outputs: {
      outDir: path.join(outRoot, name),
      fileName: "[entry].[env].[hash].js",
      htmlFileName: "[entry].html",
      cssFileName: "[entry].[env].[hash].css",
    },
  });
  const document = result.manifest.documents?.[0];
  expect(document).toEqual(
    expect.objectContaining({
      entryId: htmlPath,
      fileName: "index.html",
    }),
  );
  expect(document.scripts).toHaveLength(2);
  expect(document.styles.length).toBeGreaterThanOrEqual(2);
  expect(document.assets).toHaveLength(1);
  const html = await fs.readFile(
    path.join(outRoot, name, document.fileName),
    "utf8",
  );
  for (const fileName of [
    ...document.scripts,
    ...document.styles,
    ...document.assets,
  ]) {
    expect(html).toContain(path.basename(fileName));
    await expect(fs.access(path.join(outRoot, name, fileName))).resolves.toBe(
      undefined,
    );
  }
  expect(html).not.toContain("document.body.dataset.inline");
  expect(html).not.toContain("sha384-stale");
  expect(html.match(/integrity="sha384-[^"]+"/g)).toHaveLength(2);
  expect(html.match(/assets\/logo\.[a-z0-9]+\.svg/g)).toHaveLength(4);
  expect(html).toContain("data:image/png;base64,AAAA 1x");
  const documentCss = await Promise.all(
    document.styles.map((fileName) =>
      fs.readFile(path.join(outRoot, name, fileName), "utf8"),
    ),
  );
  expect(documentCss.some((css) => css.includes(".client-loaded"))).toBe(true);
});

test("links shared CSS into multiple HTML documents without duplication", async () => {
  const name = "html-shared-css";
  const fixtureDir = path.join(fixturesDir, "html-entry");
  const outDir = path.join(outRoot, name);
  const result = await buildFixture(name, {
    entries: [
      { id: "index", path: path.join(fixtureDir, "index.html"), kind: "html" },
      {
        id: "second",
        path: path.join(fixtureDir, "second.html"),
        kind: "html",
      },
    ],
    outputs: {
      outDir,
      fileName: "[entry].[env].[hash].js",
      htmlFileName: "[entry].html",
      cssFileName: "[entry].[env].[hash].css",
    },
  });

  expect(result.manifest.documents).toHaveLength(2);
  for (const document of result.manifest.documents) {
    expect(document.styles.length).toBeGreaterThan(0);
    const html = await fs.readFile(
      path.join(outDir, document.fileName),
      "utf8",
    );
    for (const styleFile of document.styles) {
      expect(html).toContain(path.basename(styleFile));
    }
  }
  const styles = await Promise.all(
    result.manifest.assets
      .filter((asset) => asset.type === "style")
      .map((asset) => fs.readFile(path.join(outDir, asset.fileName), "utf8")),
  );
  expect(
    styles.filter((css) => css.includes("box-sizing: border-box")),
  ).toHaveLength(1);
});

test("hydrates HTML resource templates from the remote cache", async () => {
  const name = "html-remote-cache";
  const cacheDir = path.join(cacheRoot, name);
  const remoteDir = path.join(cacheRoot, `${name}-remote`);
  const cache = {
    local: { dir: cacheDir },
    remote: { kind: "file", dir: remoteDir, prefix: "test" },
  };
  const options = {
    entries: [
      {
        id: "index",
        path: path.join(fixturesDir, "html-entry", "index.html"),
        kind: "html",
      },
    ],
    outputs: {
      outDir: path.join(outRoot, name),
      fileName: "[entry].[env].[hash].js",
      htmlFileName: "[entry].html",
    },
    cacheDir,
    cache,
  };
  await fs.rm(cacheDir, { recursive: true, force: true });
  await fs.rm(remoteDir, { recursive: true, force: true });
  await buildFixture(name, options);
  const remoteDocuments = await fs.readdir(
    path.join(remoteDir, "test", "documents"),
  );
  expect(remoteDocuments.some((fileName) => fileName.endsWith(".json"))).toBe(
    true,
  );

  await fs.rm(cacheDir, { recursive: true, force: true });
  await buildFixture(name, options);
  const localDocuments = await fs.readdir(path.join(cacheDir, "documents"));
  expect(localDocuments.some((fileName) => fileName.endsWith(".json"))).toBe(
    true,
  );
});

test("links runtime module paths without embedding source paths", async () => {
  const name = "module-paths";
  const result = await buildFixture(name, {
    envs: { node: { conditions: ["node"], target: "node" } },
  });
  const bundle = result.bundles[0];
  const bundlePath = path.join(outRoot, name, bundle.fileName);
  const code = await fs.readFile(bundlePath, "utf8");
  expect(code).not.toContain(path.join(fixturesDir, name));
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const { stdout } = await execFileAsync(process.execPath, [
    "--eval",
    `import(${JSON.stringify(pathToFileURL(bundlePath).href)}).then((mod) => console.log(JSON.stringify({ dirname: mod.dirname, filename: mod.filename, moduleUrl: mod.moduleUrl })))`,
  ]);
  const loaded = JSON.parse(stdout);
  expect(loaded.dirname).toBe(path.dirname(bundlePath));
  expect(loaded.filename).toBe(bundlePath);
  expect(loaded.moduleUrl).toBe(pathToFileURL(bundlePath).href);
});

test("rejects Node filesystem path references while linking browser bundles", async () => {
  await expect(
    buildFixture("module-paths-browser", {
      entries: [
        {
          id: "module-paths-browser",
          path: path.join(fixturesDir, "module-paths", "src/index.js"),
        },
      ],
      envs: {
        browser: { conditions: ["browser"], target: "browser" },
      },
      outputs: {
        outDir: path.join(outRoot, "module-paths-browser"),
        fileName: "module-paths-browser.[scope].[hash].js",
      },
    }),
  ).rejects.toThrow(
    "Node path references cannot be linked into a browser-target bundle",
  );
});

test("emits imported binary assets with linked URLs", async () => {
  const name = "asset-import";
  const result = await buildFixture(name);
  const bundle = result.bundles[0];
  const bundlePath = path.join(outRoot, name, bundle.fileName);
  const assets = result.manifest.assets.filter((item) => item.type === "asset");
  expect(assets).toHaveLength(1);
  const [asset] = assets;
  expect(asset.fileName).toMatch(/^assets\/logo\.[a-z0-9]+\.svg$/);
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const { stdout } = await execFileAsync(process.execPath, [
    "--eval",
    `import(${JSON.stringify(pathToFileURL(bundlePath).href)}).then((mod) => console.log(JSON.stringify({ logo: mod.logo, freshLogo: mod.freshLogo.href })))`,
  ]);
  const loaded = JSON.parse(stdout);
  const assetUrl = `/${asset.fileName}`;
  expect(loaded).toEqual({
    logo: { src: assetUrl, width: 4, height: 4 },
    freshLogo: new URL(assetUrl, pathToFileURL(bundlePath)).href,
  });
});

test("transforms JSON modules to one default export and preserves raw intent", async () => {
  const name = "json-import";
  const result = await buildFixture(name);
  const bundlePath = path.join(outRoot, name, result.bundles[0].fileName);
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );

  const module = await import(pathToFileURL(bundlePath).href);
  const source = await fs.readFile(
    path.join(fixturesDir, name, "src/data.json"),
    "utf8",
  );
  expect(module.result).toEqual({
    data: JSON.parse(source),
    hasOwnProto: true,
    negativeZero: true,
    raw: source,
  });
  expect(
    result.manifest.assets.filter((item) => item.type === "asset"),
  ).toEqual([]);
  expect(await fs.readFile(bundlePath, "utf8")).toContain("JSON.parse(");
});

test("automatically removes types from TypeScript and TSX modules", async () => {
  const name = "typescript";
  const result = await buildFixture(name, {
    entries: [
      {
        id: name,
        path: path.join(fixturesDir, name, "src/index.ts"),
      },
    ],
    configPlugins: [
      {
        __bundlerPluginRef: true,
        module: path.join(rootDir, "packages/react-jsx-plugin/bundler.mjs"),
      },
    ],
  });
  const bundlePath = path.join(outRoot, name, result.bundles[0].fileName);
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );

  const module = await import(pathToFileURL(bundlePath).href);
  expect(module.result).toEqual({
    type: "strong",
    properties: { "data-kind": "badge" },
    child: "ready",
  });
  const output = await fs.readFile(bundlePath, "utf8");
  expect(output).not.toMatch(/\b(?:interface|type)\s+Badge/);
  expect(output).not.toContain(": BadgeModel");
  expect(output).toContain("React.createElement");
});

test("resolves new URL assets against a configured root URL", async () => {
  const name = "asset-root-url";
  const outDir = path.join(outRoot, name);
  const result = await buildFixture(name, {
    entries: [
      {
        id: name,
        path: path.join(fixturesDir, "asset-import", "src/index.js"),
      },
    ],
    outputs: {
      outDir,
      fileName: "[entry].[env].[hash].js",
      rootURL: "/static/",
    },
  });
  const bundlePath = path.join(outDir, result.bundles[0].fileName);
  await fs.writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const { stdout } = await execFileAsync(process.execPath, [
    "--eval",
    `import(${JSON.stringify(pathToFileURL(bundlePath).href)}).then((mod) => console.log(JSON.stringify({ logo: mod.logo, freshLogo: mod.freshLogo.href })))`,
  ]);
  const loaded = JSON.parse(stdout);
  expect(loaded.logo).toMatchObject({ width: 4, height: 4 });
  expect(loaded.logo.src).toMatch(/^\/static\/assets\/logo\.[a-z0-9]+\.svg$/);
  expect(loaded.freshLogo).toBe(
    new URL(loaded.logo.src, pathToFileURL(bundlePath)).href,
  );
});

test("transforms raw and base64 asset intents without copying output", async () => {
  const name = "asset-variants";
  const result = await buildFixture(name);
  const bundlePath = path.join(outRoot, name, result.bundles[0].fileName);
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const module = await import(pathToFileURL(bundlePath).href);
  expect(module.values).toEqual({
    raw: "portable asset text\n",
    base64: Buffer.from("portable asset text\n").toString("base64"),
  });
  expect(
    result.manifest.assets.filter((item) => item.type === "asset"),
  ).toEqual([]);
});

test("unifies query, attributed, sized-image, and dynamic URL representations", async () => {
  const name = "import-representations";
  const result = await buildFixture(name);
  const entryBundle = result.bundles.find(
    (bundle) =>
      bundle.exportMode === "entry" && bundle.entryId.endsWith("index.js"),
  );
  const bundlePath = path.join(outRoot, name, entryBundle.fileName);
  await fs.writeFile(
    path.join(outRoot, name, "package.json"),
    JSON.stringify({ type: "module" }),
  );

  const loaded = await import(pathToFileURL(bundlePath).href);
  expect(loaded.values).toEqual({
    queryUrl: expect.stringMatching(/^\/assets\/logo\.[a-z0-9]+\.svg$/),
    directUrl: expect.stringMatching(/^\/assets\/logo\.[a-z0-9]+\.svg$/),
    sameUrl: true,
    sized: {
      src: expect.stringMatching(/^\/assets\/logo\.[a-z0-9]+\.svg$/),
      width: 6,
      height: 9,
    },
    raw: "portable representation text\n",
    encoded: Buffer.from("portable representation text\n").toString("base64"),
    className: expect.stringMatching(/_proof$/),
    stylesheetUrl: expect.stringMatching(/styles[^/]*\.[a-z0-9]+\.css$/),
  });
  const feature = await loaded.loadFeature();
  expect(feature.default).toBe(42);
  expect(feature.named).toBe("feature");

  const moduleIds = result.manifest.assets
    .filter((asset) => asset.type === "script")
    .flatMap((asset) => asset.modules ?? []);
  expect(moduleIds).toEqual(
    expect.arrayContaining([
      expect.stringContaining("src/logo.svg::as=url"),
      expect.stringContaining("src/logo.svg::as=image-reference-with-size"),
      expect.stringContaining("src/data.txt::as=raw"),
      expect.stringContaining("src/data.txt::as=base64"),
      expect.stringContaining("src/feature.js::as=url"),
      expect.stringContaining("src/styles.module.css::as=css-dependency"),
      expect.stringContaining("src/styles.module.css::as=url"),
    ]),
  );
  expect(
    result.manifest.assets.filter((asset) => asset.type === "asset"),
  ).toHaveLength(1);
  expect(
    result.manifest.assets.filter((asset) => asset.type === "style"),
  ).toHaveLength(2);
});

test("runs a selected representation worker once per environment and links its logical outputs", async () => {
  const name = "custom-representation";
  const projectDir = path.join(outRoot, name);
  const sourceDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/representation-plugin.mjs",
  );
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.copyFile(
    path.join(fixturesDir, "import-representations/src/custom.resource"),
    path.join(sourceDir, "custom.resource"),
  );
  await fs.writeFile(
    path.join(sourceDir, "index.js"),
    `import outputUrl, { environment } from "./custom.resource" with { as: "test-uppercase" };
export const selectedEnvironment = environment;
export const selectedOutputUrl = outputUrl;`,
  );

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: {
        browser: { conditions: ["browser"], target: "browser" },
        node: { conditions: ["node"], target: "node" },
      },
      entries: [{ id: name, path: path.join(sourceDir, "index.js") }],
      outputs: { outDir, fileName: "[entry].[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [{ __bundlerPluginRef: true, module: pluginModule }],
    },
    [],
  );

  for (const environment of ["browser", "node"]) {
    const bundle = result.bundles.find(
      (candidate) => candidate.envId === environment,
    );
    const bundleUrl = new URL(
      `${bundle.fileName}?environment=${environment}`,
      pathToFileURL(`${outDir}${path.sep}`),
    ).href;
    const { stdout } = await execFileAsync(process.execPath, [
      "--input-type=module",
      "--eval",
      `import fs from "node:fs/promises";
const namespace = await import(${JSON.stringify(bundleUrl)});
const contents = await fs.readFile(new URL(namespace.selectedOutputUrl), "utf8");
console.log(JSON.stringify({ environment: namespace.selectedEnvironment, contents }));`,
    ]);
    expect(JSON.parse(stdout)).toEqual({
      environment,
      contents: "HELLO REPRESENTATION\n!",
    });
    await expect(
      fs.readFile(
        path.join(outDir, `custom/lowercase.${environment}.txt`),
        "utf8",
      ),
    ).resolves.toBe("hello representation\n");
    await expect(
      fs.readFile(path.join(outDir, `custom/index.${environment}.txt`), "utf8"),
    ).resolves.toBe(`primary=./uppercase.${environment}.txt`);
  }
  expect(
    result.manifest.bundles
      .flatMap((bundle) => bundle.modules)
      .filter((moduleId) => moduleId.includes("::as=test-uppercase")),
  ).toHaveLength(2);
});

test.each([
  ["missing", /Missing logical output/],
  ["conflict", /Conflicting logical output/],
])("rejects %s plugin logical outputs", async (mode, expected) => {
  const projectDir = path.join(outRoot, `custom-representation-${mode}`);
  const sourceDir = path.join(projectDir, "src");
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/representation-plugin.mjs",
  );
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(path.join(sourceDir, "custom.resource"), "value\n");
  await fs.writeFile(
    path.join(sourceDir, "index.js"),
    `import outputUrl from "./custom.resource" with { as: "test-uppercase" };
export const value = outputUrl;`,
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await expect(
    buildProject(
      {
        envs: {
          browser: { conditions: ["browser"], target: "browser" },
        },
        entries: [
          {
            id: `custom-representation-${mode}`,
            path: path.join(sourceDir, "index.js"),
          },
        ],
        outputs: {
          outDir: path.join(projectDir, "dist"),
          fileName: "[entry].[env].[hash].js",
        },
        cacheDir: path.join(projectDir, ".cache"),
        maxWorkers: 1,
        diagnostics: "human",
        plugins: [
          {
            __bundlerPluginRef: true,
            module: pluginModule,
            options: { mode },
          },
        ],
      },
      [],
    ),
  ).rejects.toThrow(expected);
});

test("rejects cyclic logical module outputs", async () => {
  const projectDir = path.join(outRoot, "cyclic-logical-outputs");
  const sourceDir = path.join(projectDir, "src");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(
    path.join(sourceDir, "index.js"),
    `import aUrl from "./a.js" with { as: "url" };
export const value = aUrl;`,
  );
  await fs.writeFile(
    path.join(sourceDir, "a.js"),
    `import bUrl from "./b.js" with { as: "url" };
export const value = bUrl;`,
  );
  await fs.writeFile(
    path.join(sourceDir, "b.js"),
    `import aUrl from "./a.js" with { as: "url" };
export const value = aUrl;`,
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  await expect(
    buildProject(
      {
        envs: {
          browser: { conditions: ["browser"], target: "browser" },
        },
        entries: [
          {
            id: "cyclic-logical-outputs",
            path: path.join(sourceDir, "index.js"),
          },
        ],
        outputs: {
          outDir: path.join(projectDir, "dist"),
          fileName: "[entry].[env].[hash].js",
        },
        cacheDir: path.join(projectDir, ".cache"),
        maxWorkers: 1,
        diagnostics: "human",
      },
      [],
    ),
  ).rejects.toThrow(/Cyclic logical output/);
});

test("relinks changed representation targets without retransformation of the importer", async () => {
  const name = "representation-target-cache";
  const projectDir = path.join(rootDir, "tmp", name);
  const sourceDir = path.join(projectDir, "src");
  const entryPath = path.join(sourceDir, "index.js");
  const featurePath = path.join(sourceDir, "feature.js");
  const outDir = path.join(outRoot, name);
  const cacheDir = path.join(projectDir, ".cache");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(
    entryPath,
    'export const load = () => import("./feature.js");',
  );
  await fs.writeFile(featurePath, 'export const value = "first";');

  const options = {
    entries: [{ id: name, path: entryPath }],
    cacheDir,
    outputs: {
      outDir,
      fileName: `${name}.[env].[hash].js`,
    },
  };
  const first = await buildFixture(name, options);
  const transformRoot = await findTransformCacheRoot(cacheDir);
  const pkgRoot = findPkgRoot(entryPath) ?? path.dirname(entryPath);
  const entryFileHash = contentHash(
    packagePathIdentity(readPkgSafe(pkgRoot), entryPath),
  );
  const entryModuleRoot = path.join(transformRoot, "files", entryFileHash);
  const entryModulePath = path.join(
    entryModuleRoot,
    await findModuleCacheSuffix(entryModuleRoot),
  );
  const firstStat = await fs.stat(entryModulePath);
  const firstEntryFile = first.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  ).fileName;

  await new Promise((resolve) => setTimeout(resolve, 25));
  await fs.writeFile(featurePath, 'export const value = "second";');
  const second = await buildFixture(name, options);
  const secondEntryFile = second.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  ).fileName;

  expect((await fs.stat(entryModulePath)).mtimeMs).toBe(firstStat.mtimeMs);
  expect(secondEntryFile).not.toBe(firstEntryFile);
});

test("preserves binary assets and changes bundle hashes with asset contents", async () => {
  const projectDir = path.join(rootDir, "tmp", "asset-binary-hash");
  const sourceDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const cacheDir = path.join(projectDir, ".cache");
  const entryPath = path.join(sourceDir, "index.js");
  const assetPath = path.join(sourceDir, "payload.wasm");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name: "asset-binary-hash",
      version: "1.0.0",
      type: "module",
    }),
  );
  await fs.writeFile(
    entryPath,
    'import payloadUrl from "./payload.wasm"; export const payload = payloadUrl;',
  );
  const firstBytes = Uint8Array.from([0, 255, 1, 128, 2, 127]);
  await fs.writeFile(assetPath, firstBytes);
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const build = () =>
    buildProject(
      {
        envs: { browser: { conditions: ["default"], target: "browser" } },
        entries: [{ id: "binary", path: entryPath }],
        outputs: { outDir, fileName: "[entry].[env].[hash].js" },
        cacheDir,
        maxWorkers: 2,
        diagnostics: "human",
      },
      [],
    );
  const first = await build();
  const firstAsset = first.manifest.assets.find(
    (asset) => asset.type === "asset",
  );
  expect(await fs.readFile(path.join(outDir, firstAsset.fileName))).toEqual(
    Buffer.from(firstBytes),
  );

  const secondBytes = Uint8Array.from([0, 255, 1, 128, 3, 127]);
  await fs.writeFile(assetPath, secondBytes);
  const second = await build();
  const secondAsset = second.manifest.assets.find(
    (asset) => asset.type === "asset",
  );
  expect(await fs.readFile(path.join(outDir, secondAsset.fileName))).toEqual(
    Buffer.from(secondBytes),
  );
  expect(secondAsset.fileName).not.toBe(firstAsset.fileName);
  expect(second.bundles[0].fileName).not.toBe(first.bundles[0].fileName);
});

test("records dynamic chunk CSS without injecting a runtime loader", async () => {
  const name = "dynamic-css";
  const outDir = path.join(outRoot, name);
  const result = await buildFixture(name, {
    outputs: {
      outDir,
      fileName: `${name}.[env].[hash].js`,
      manifestFile: "manifest.json",
    },
  });
  const entry = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/index.js"),
  );
  const feature = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/feature.js"),
  );
  const code = await fs.readFile(
    path.join(outRoot, name, entry.fileName),
    "utf8",
  );
  const style = result.manifest.assets.find((item) => item.type === "style");
  expect(style).toBeDefined();
  expect(code).not.toContain("__bundler_load_css__");
  expect(code).not.toContain('document.createElement("link")');
  expect(code).toContain("import(");
  const featureEntrypoint = result.entrypoints[`browser:${feature.entryId}`];
  expect(featureEntrypoint.bundles).toContain(feature.fileName);
  expect(featureEntrypoint.styles).toEqual([style.fileName]);
  const writtenManifest = JSON.parse(
    await fs.readFile(path.join(outDir, "manifest.json"), "utf8"),
  );
  expect(writtenManifest.entrypoints[`browser:${feature.entryId}`]).toEqual(
    undefined,
  );
  expect(
    writtenManifest.entrypoints[`${feature.scopeIds[0]}:${feature.entryId}`],
  ).toEqual(featureEntrypoint);
  const css = await fs.readFile(
    path.join(outRoot, name, style.fileName),
    "utf8",
  );
  expect(css).toMatch(/url\("\/assets\/pixel\.[a-z0-9]+\.svg"\)/);
  expect(css).not.toContain("/assets/assets/");
});

test("does not inject the browser CSS loader into node dynamic imports", async () => {
  const name = "dynamic-css-node";
  const result = await buildFixture(name, {
    envs: {
      server: { conditions: ["node"], target: "node" },
    },
    entries: [
      {
        id: name,
        path: path.join(fixturesDir, "dynamic-css", "src/index.js"),
      },
    ],
    outputs: {
      outDir: path.join(outRoot, name),
      fileName: "[entry].[env].[hash].js",
    },
  });
  const entry = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/index.js"),
  );
  const code = await fs.readFile(
    path.join(outRoot, name, entry.fileName),
    "utf8",
  );
  expect(code).not.toContain("__bundler_load_css__");
  expect(code).not.toContain('document.createElement("link")');
  expect(code).toContain("import(");
  const feature = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/feature.js"),
  );
  const style = result.manifest.assets.find((item) => item.type === "style");
  expect(result.entrypoints[`server:${feature.entryId}`].styles).toEqual([
    style.fileName,
  ]);
});

test("joins CSS asset and stylesheet paths after a configured root URL", async () => {
  const name = "dynamic-css-root-url";
  const outDir = path.join(outRoot, name);
  const result = await buildFixture(name, {
    entries: [
      {
        id: name,
        path: path.join(fixturesDir, "dynamic-css", "src/index.js"),
      },
    ],
    outputs: {
      outDir,
      fileName: "[entry].[env].[hash].js",
      rootURL: "https://cdn.example.test/app/",
    },
  });
  const entry = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/index.js"),
  );
  const feature = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/feature.js"),
  );
  const style = result.manifest.assets.find((item) => item.type === "style");
  const code = await fs.readFile(path.join(outDir, entry.fileName), "utf8");
  const css = await fs.readFile(path.join(outDir, style.fileName), "utf8");

  expect(code).not.toContain(style.fileName);
  expect(result.entrypoints[`browser:${feature.entryId}`].styles).toEqual([
    style.fileName,
  ]);
  expect(css).toMatch(
    /url\("https:\/\/cdn\.example\.test\/app\/assets\/pixel\.[a-z0-9]+\.svg"\)/,
  );
});

test("keeps environment-distinct browser and node dynamic-CSS bundles free of target glue", async () => {
  const name = "dynamic-css-universal";
  const outDir = path.join(outRoot, name);
  const entryPath = path.join(fixturesDir, "dynamic-css", "src/index.js");
  const result = await buildFixture(name, {
    envs: {
      browser: { conditions: ["default"], target: "browser" },
      server: { conditions: ["default"], target: "node" },
    },
    entries: [{ id: name, path: entryPath }],
    outputs: {
      outDir,
      fileName: "[entry].[scope].[hash].js",
    },
  });
  const browserEntry = result.entrypoints[`browser:${entryPath}`];
  const serverEntry = result.entrypoints[`server:${entryPath}`];
  expect(browserEntry.fileName).not.toBe(serverEntry.fileName);
  expect(result.bundles).toHaveLength(4);

  const [browserCode, serverCode] = await Promise.all([
    fs.readFile(path.join(outDir, browserEntry.fileName), "utf8"),
    fs.readFile(path.join(outDir, serverEntry.fileName), "utf8"),
  ]);
  for (const code of [browserCode, serverCode]) {
    expect(code).not.toContain("__bundler_load_css__");
    expect(code).not.toContain("document.");
  }
  await fs.writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const imported = await import(
    `${pathToFileURL(path.join(outDir, browserEntry.fileName)).href}?universal-css=${Date.now()}`
  );
  await expect(imported.loadFeature()).resolves.toMatchObject({
    feature: true,
  });
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
  const entryPkgRoot = findPkgRoot(entryPath) ?? path.dirname(entryPath);
  const entryFileHash = contentHash(
    packagePathIdentity(readPkgSafe(entryPkgRoot), entryPath),
  );
  const entryModulePath = path.join(
    await findTransformCacheRoot(cacheDir),
    "files",
    entryFileHash,
    await findModuleCacheSuffix(
      path.join(await findTransformCacheRoot(cacheDir), "files", entryFileHash),
    ),
  );
  const moduleJson = JSON.parse(await fs.readFile(entryModulePath, "utf8"));
  const fileRecord =
    Object.values(moduleJson.scopeVariants ?? {})[0]?.fileRecord ??
    moduleJson.fileRecordsByEnv?.browser ??
    moduleJson.fileRecordsByEnv?.default ??
    Object.values(moduleJson.fileRecordsByEnv ?? {})[0] ??
    moduleJson.fileRecord;
  const artifactPaths = fileRecord.cells
    .map((cell) => cell.artifactPath)
    .filter(Boolean)
    .map((artifactPath) =>
      path.join(path.dirname(entryModulePath), artifactPath),
    );
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

test("reuses cached asset artifacts when external source maps are enabled", async () => {
  const name = "asset-import";
  const cacheDir = path.join(cacheRoot, "asset-source-map-cache-hit");
  const outDir = path.join(outRoot, name);
  await fs.rm(cacheDir, { recursive: true, force: true });

  const options = {
    cacheDir,
    outputs: {
      outDir,
      fileName: `${name}.[env].[hash].js`,
      sourceMap: "external",
    },
  };
  await buildFixture(name, options);

  const transformRoot = await findTransformCacheRoot(cacheDir);
  const logoPath = path.join(fixturesDir, name, "src/logo.svg");
  const logoPkgRoot = findPkgRoot(logoPath) ?? path.dirname(logoPath);
  const logoFileHash = contentHash(
    packagePathIdentity(readPkgSafe(logoPkgRoot), logoPath),
  );
  const logoModuleRoot = path.join(transformRoot, "files", logoFileHash);
  const logoModulePath = path.join(
    logoModuleRoot,
    await findModuleCacheSuffix(logoModuleRoot),
  );
  const firstModuleStat = await fs.stat(logoModulePath);

  await new Promise((resolve) => setTimeout(resolve, 25));
  await buildFixture(name, options);

  expect((await fs.stat(logoModulePath)).mtimeMs).toBe(firstModuleStat.mtimeMs);
});

test("writes and replaces readable debug transformations, including cache hits", async () => {
  const projectDir = path.join(outRoot, "debug-transformations");
  const cacheDir = path.join(projectDir, ".cache/conditional-bundler");
  const debugDir = path.join(projectDir, ".cache/__DEBUG__");
  await fs.rm(projectDir, { recursive: true, force: true });

  await buildFixture("simple", { cacheDir, debug: true });
  const firstFiles = await fs.readdir(debugDir, { recursive: true });
  const inputFile = firstFiles.find((file) =>
    file.endsWith(
      path.join(
        "src",
        "index.js",
        "__environment=browser",
        "browser_browser",
        "input.js",
      ),
    ),
  );
  const recordFile = firstFiles.find((file) =>
    file.endsWith(
      path.join(
        "src",
        "index.js",
        "__environment=browser",
        "browser_browser",
        "record.json",
      ),
    ),
  );
  expect(inputFile).toBeDefined();
  expect(recordFile).toBeDefined();
  expect(
    firstFiles.some((file) => file.includes(`${path.sep}cells${path.sep}`)),
  ).toBe(true);
  expect(
    JSON.parse(await fs.readFile(path.join(debugDir, recordFile), "utf8")).input
      .cacheHit,
  ).toBe(false);

  await fs.writeFile(path.join(debugDir, "stale-marker.txt"), "stale");
  await buildFixture("simple", { cacheDir, debug: true });
  await expect(
    fs.stat(path.join(debugDir, "stale-marker.txt")),
  ).rejects.toThrow();
  const secondFiles = await fs.readdir(debugDir, { recursive: true });
  const secondRecord = secondFiles.find((file) =>
    file.endsWith(
      path.join(
        "src",
        "index.js",
        "__environment=browser",
        "browser_browser",
        "record.json",
      ),
    ),
  );
  expect(
    JSON.parse(await fs.readFile(path.join(debugDir, secondRecord), "utf8"))
      .input.cacheHit,
  ).toBe(true);

  const debugRecordPath = path.join(debugDir, secondRecord);
  const debugRecordMtime = (await fs.stat(debugRecordPath)).mtimeMs;
  await buildFixture("simple", { cacheDir, debug: false });
  expect((await fs.stat(debugRecordPath)).mtimeMs).toBe(debugRecordMtime);
});

test("relinks output-name changes without transforming cached modules", async () => {
  const cacheDir = path.join(cacheRoot, "output-name-relink");
  const outDir = path.join(outRoot, "output-name-relink");
  await fs.rm(cacheDir, { recursive: true, force: true });

  const first = await buildFixture("simple", {
    cacheDir,
    outputs: {
      outDir,
      fileName: "first.[entry].[env].[hash].js",
      publicPath: "/first/",
    },
  });
  const v2Dir = path.join(cacheDir, "v2");
  const [configRoot] = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const transformRoot = await findTransformCacheRoot(cacheDir);
  const moduleFiles = (
    await fs.readdir(transformRoot, {
      recursive: true,
    })
  ).filter((fileName) => fileName.endsWith("module.json"));
  expect(moduleFiles.length).toBeGreaterThan(0);
  const modulePath = path.join(transformRoot, moduleFiles[0]);
  const firstModuleStat = await fs.stat(modulePath);

  await new Promise((resolve) => setTimeout(resolve, 25));
  const second = await buildFixture("simple", {
    cacheDir,
    outputs: {
      outDir,
      fileName: "second.[entry].[env].[hash].js",
      publicPath: "/second/",
    },
  });

  const configRoots = (await fs.readdir(v2Dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(configRoots).toEqual([configRoot]);
  expect((await fs.stat(modulePath)).mtimeMs).toBe(firstModuleStat.mtimeMs);
  expect(first.bundles[0].fileName).toMatch(/^first\./);
  expect(second.bundles[0].fileName).toMatch(/^second\./);
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

async function findTransformCacheRoot(cacheDir) {
  const base = path.join(cacheDir, "transform-v3");
  const roots = (await fs.readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (roots.length !== 1) {
    throw new Error(
      `Expected one transform cache root under ${base}, found ${roots.length}.`,
    );
  }
  return path.join(base, roots[0]);
}

test("uses different config roots when the bundler config changes", async () => {
  const cacheDir = path.join(cacheRoot, "config-roots");
  await fs.rm(cacheDir, { recursive: true, force: true });

  await buildFixture("simple", { cacheDir });

  const entry = path.join(fixturesDir, "simple", "src/index.js");
  const outDir = path.join(outRoot, "simple-alt-config");
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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
  for (const relativePath of await fs.readdir(remoteDir, {
    recursive: true,
  })) {
    if (path.basename(relativePath) !== "module.json") continue;
    await fs.rm(path.join(remoteDir, relativePath), { force: true });
  }
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

test("reuses transformed CJS artifacts after relocating a package", async () => {
  const firstRoot = path.join(outRoot, "portable-cache-first");
  const secondRoot = path.join(outRoot, "portable-cache-second");
  const remoteDir = path.join(cacheRoot, "portable-cache-remote");

  const prepareProject = async (projectRoot) => {
    await fs.rm(projectRoot, { recursive: true, force: true });
    await fs.mkdir(path.join(projectRoot, "src"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({
        name: "portable-cache-fixture",
        version: "1.0.0",
        type: "module",
      }),
    );
    await fs.writeFile(
      path.join(projectRoot, "src/index.js"),
      'import legacy from "./legacy.cjs"; export const load = legacy;\n',
    );
    await fs.writeFile(
      path.join(projectRoot, "src/legacy.cjs"),
      "module.exports = name => require(name);\n",
    );
    await fs.writeFile(
      path.join(projectRoot, "portable-plugin.mjs"),
      'export default function portablePlugin() { return { name: "portable-transform", transform: ["./portable-babel.mjs"] }; }\n',
    );
    await fs.writeFile(
      path.join(projectRoot, "portable-babel.mjs"),
      'export default function portableBabel() { return { visitor: { Program() { if (process.env.BUNDLER_THROW_TRANSFORM === "1") throw new Error("transform should have been cached"); } } }; }\n',
    );
  };
  const buildRelocated = async (projectRoot) => {
    const { buildProject: rawBuildProject } =
      await import("../dist/builder.js");
    const buildProject = withTestConfig(rawBuildProject);
    return buildProject(
      {
        envs: {
          browser: { conditions: ["default"], target: "browser" },
        },
        entries: [
          {
            id: "portable-cache",
            path: path.join(projectRoot, "src/index.js"),
          },
        ],
        outputs: {
          outDir: path.join(projectRoot, "dist"),
          fileName: "bundle.[env].[hash].js",
          sourceMap: "external",
        },
        cache: {
          local: { dir: path.join(projectRoot, ".cache") },
          remote: {
            kind: "file",
            dir: remoteDir,
            prefix: "portable-cache-test",
          },
        },
        maxWorkers: 2,
        diagnostics: "human",
        plugins: [
          {
            __bundlerPluginRef: true,
            module: "@bundler/cjs-to-esm/bundler",
            options: { nodeEnv: "production" },
          },
          {
            __bundlerPluginRef: true,
            module: path.join(projectRoot, "portable-plugin.mjs"),
          },
        ],
      },
      [],
    );
  };

  await fs.rm(remoteDir, { recursive: true, force: true });
  await Promise.all([prepareProject(firstRoot), prepareProject(secondRoot)]);
  const first = await buildRelocated(firstRoot);

  process.env.BUNDLER_THROW_TRANSFORM = "1";
  let second;
  try {
    second = await buildRelocated(secondRoot);
  } finally {
    delete process.env.BUNDLER_THROW_TRANSFORM;
  }

  const firstCode = await fs.readFile(
    path.join(firstRoot, "dist", first.bundles[0].fileName),
    "utf8",
  );
  const secondCode = await fs.readFile(
    path.join(secondRoot, "dist", second.bundles[0].fileName),
    "utf8",
  );
  expect(secondCode).toBe(firstCode);
  expect(secondCode).toContain("portable-cache-fixture@1.0.0::src/legacy.cjs");

  const inspectedFiles = [
    path.join(secondRoot, "dist", `${second.bundles[0].fileName}.map`),
    ...(await fs.readdir(remoteDir, { recursive: true })).map((file) =>
      path.join(remoteDir, file),
    ),
  ];
  for (const filePath of inspectedFiles) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    const contents = await fs.readFile(filePath, "utf8");
    expect(contents).not.toContain(firstRoot);
    expect(contents).not.toContain(secondRoot);
  }
});

test("keeps hashed bundle filenames stable after relocating an identical graph", async () => {
  const firstRoot = path.join(outRoot, "portable-output-first");
  const secondRoot = path.join(outRoot, "portable-output-second");
  const prepareProject = async (projectRoot) => {
    await fs.rm(projectRoot, { recursive: true, force: true });
    await fs.mkdir(path.join(projectRoot, "src"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({
        name: "portable-output-fixture",
        version: "1.0.0",
        type: "module",
      }),
    );
    await fs.writeFile(
      path.join(projectRoot, "src/index.js"),
      `import { shared } from "./shared.js";
export const value = shared;
export const load = () => import("./lazy.js");`,
    );
    await fs.writeFile(
      path.join(projectRoot, "src/lazy.js"),
      `import { shared } from "./shared.js"; export const lazy = shared;`,
    );
    await fs.writeFile(
      path.join(projectRoot, "src/shared.js"),
      `export const shared = "portable";`,
    );
  };
  const buildRelocated = async (projectRoot) => {
    const { buildProject: rawBuildProject } =
      await import("../dist/builder.js");
    const buildProject = withTestConfig(rawBuildProject);
    return buildProject(
      {
        envs: { browser: { conditions: ["default"], target: "browser" } },
        entries: [
          { id: "index", path: path.join(projectRoot, "src/index.js") },
        ],
        outputs: {
          outDir: path.join(projectRoot, "dist"),
          fileName: "[entry].[scope].[hash].js",
        },
        cacheDir: path.join(projectRoot, ".cache"),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
      },
      [],
    );
  };
  const summarize = async (projectRoot, result) =>
    Promise.all(
      result.bundles
        .map((bundle) => ({
          entry: path.basename(bundle.entryId),
          fileName: bundle.fileName,
        }))
        .sort((left, right) => left.entry.localeCompare(right.entry))
        .map(async (bundle) => ({
          ...bundle,
          code: await fs.readFile(
            path.join(projectRoot, "dist", bundle.fileName),
            "utf8",
          ),
        })),
    );

  await Promise.all([prepareProject(firstRoot), prepareProject(secondRoot)]);
  const first = await buildRelocated(firstRoot);
  const second = await buildRelocated(secondRoot);

  expect(await summarize(secondRoot, second)).toEqual(
    await summarize(firstRoot, first),
  );
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

test("preflights nested, colliding, and escaping output paths", async () => {
  const nestedOutDir = path.join(outRoot, "nested-output-path");
  const nested = await buildFixture("simple", {
    outputs: {
      outDir: nestedOutDir,
      fileName: "chunks/[entry]/bundle.[hash].js",
    },
  });
  await expect(
    fs.stat(path.join(nestedOutDir, nested.bundles[0].fileName)),
  ).resolves.toBeDefined();

  const collisionOutDir = path.join(outRoot, "output-collision");
  await fs.rm(collisionOutDir, { recursive: true, force: true });
  await fs.mkdir(collisionOutDir, { recursive: true });
  await expect(
    buildFixture("output-collision", {
      entries: [
        {
          id: "simple",
          path: path.join(fixturesDir, "simple", "src/index.js"),
        },
        {
          id: "conditional",
          path: path.join(fixturesDir, "conditional", "src/index.js"),
        },
      ],
      outputs: {
        outDir: collisionOutDir,
        fileName: "same.js",
      },
    }),
  ).rejects.toThrow("Output path collision");
  expect(await fs.readdir(collisionOutDir)).toEqual([]);

  const escapeOutDir = path.join(outRoot, "output-escape");
  const escapedFile = path.join(outRoot, "bundler-escaped-output.js");
  await fs.rm(escapedFile, { force: true });
  await expect(
    buildFixture("output-escape", {
      entries: [
        {
          id: "simple",
          path: path.join(fixturesDir, "simple", "src/index.js"),
        },
      ],
      outputs: {
        outDir: escapeOutDir,
        fileName: "../bundler-escaped-output.js",
      },
    }),
  ).rejects.toThrow("escapes the configured output directory");
  await expect(fs.stat(escapedFile)).rejects.toMatchObject({ code: "ENOENT" });
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
  expect(css).toContain("@media print");
  expect(css).toContain(".print-only");
  expect(css.indexOf(".before-import")).toBeLessThan(
    css.indexOf(".print-only"),
  );
  expect(css.indexOf(".print-only")).toBeLessThan(css.indexOf("body"));

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
  expect(defaultClass).toContain("shared");
  expect(namedClass).toMatch(/^[a-z0-9]+_button$/);
  expect(mod.noCollision).toBe(true);
});

test("uses exact eight-character CSS module names in production", async () => {
  const previous = process.env.BUNDLER_MODE;
  process.env.BUNDLER_MODE = "production";
  try {
    const name = "css-basic-production";
    const result = await buildFixture(name, {
      entries: [
        {
          id: name,
          path: path.join(fixturesDir, "css-basic", "src/index.js"),
        },
      ],
      outputs: {
        outDir: path.join(outRoot, name),
        fileName: `${name}.[env].[hash].js`,
      },
    });
    const bundleUrl = pathToFileURL(
      path.join(outRoot, name, result.bundles[0].fileName),
    ).href;
    const { stdout } = await execFileAsync(process.execPath, [
      "--input-type=module",
      "--eval",
      `const mod = await import(${JSON.stringify(bundleUrl)}); console.log(mod.className);`,
    ]);
    const [, namedClass] = stdout.trim().split(":");
    expect(namedClass).toMatch(/^[a-z][a-z0-9]{7}$/);
  } finally {
    if (previous === undefined) delete process.env.BUNDLER_MODE;
    else process.env.BUNDLER_MODE = previous;
  }
});

test("builds a stylesheet entry without parsing CSS during linking", async () => {
  const name = "css-style-entry";
  const outDir = path.join(outRoot, name);
  const result = await buildFixture(name, {
    entries: [
      {
        id: "styles",
        path: path.join(fixturesDir, "css-basic", "src/base.css"),
        kind: "style",
      },
    ],
    outputs: {
      outDir,
      fileName: "[entry].[env].[hash].js",
      cssFileName: "[entry].[env].[hash].css",
    },
  });

  expect(result.bundles).toHaveLength(1);
  const style = result.manifest.assets.find((asset) => asset.type === "style");
  expect(style).toBeDefined();
  const css = await fs.readFile(path.join(outDir, style.fileName), "utf8");
  expect(css).toContain("body");
  expect(css).toContain("@media print");
});

test("dev hmr emits mutable cell installers keyed by identifiers", async () => {
  const result = await buildFixture("simple", {
    outputs: {
      outDir: path.join(outRoot, "simple-hmr"),
      fileName: "simple-hmr.[env].[hash].js",
      manifestFile: "manifest.json",
    },
    dev: { hmr: true, reactRefresh: false },
  });
  const bundlePath = path.join(
    outRoot,
    "simple-hmr",
    result.bundles[0].fileName,
  );
  const output = await fs.readFile(bundlePath, "utf8");
  const runtimeBundle = result.bundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:hmr-runtime:"),
  );
  const runtimeOutput = await fs.readFile(
    path.join(outRoot, "simple-hmr", runtimeBundle.fileName),
    "utf8",
  );
  const hmrBundle =
    result.hmr.bundles[
      `${result.bundles[0].envId}:${result.bundles[0].entryId}`
    ];
  const symbolCell = hmrBundle.cells.find((cell) =>
    cell.symbols.some((symbol) => symbol.endsWith("_value")),
  );

  expect(output).toContain(
    `import { __BUNDLER_HMR__ } from "./${runtimeBundle.fileName}";`,
  );
  expect(output).toContain("__BUNDLER_HMR__.register");
  expect(output).toContain("__BUNDLER_HMR__.registerBundle");
  expect(output).not.toContain("const __BUNDLER_HMR__");
  expect(runtimeOutput).toContain("const __BUNDLER_HMR__");
  expect(runtimeOutput).toContain('message.type === "rsc-refresh"');
  expect(runtimeOutput).toContain('"bundler:rsc-refresh"');
  const valueSymbol = symbolCell.symbols.find((symbol) =>
    symbol.endsWith("_value"),
  );
  expect(output).toContain(valueSymbol);
  expect(output).toMatch(new RegExp(`${valueSymbol} = [a-z0-9]+_foo \\+ 1;`));
  expect(hmrBundle.reactRefresh).toBe(false);
  expect(symbolCell.symbols.length).toBeGreaterThan(0);
  expect(symbolCell.artifactPath).toBeDefined();
  expect(symbolCell.code).toBeUndefined();
  expect(result.manifest.metadata.hmr).toBeUndefined();
  const serializedManifest = await fs.readFile(
    path.join(outRoot, "simple-hmr", "manifest.json"),
    "utf8",
  );
  expect(serializedManifest).not.toContain("__BUNDLER_HMR__.register");
  expect(Object.prototype.hasOwnProperty.call(symbolCell, "moduleId")).toBe(
    false,
  );
  expect(Object.prototype.hasOwnProperty.call(symbolCell, "cellId")).toBe(
    false,
  );
});

test("dev hmr keeps node aliases and asset facades immutable", async () => {
  const projectDir = path.join(outRoot, "hmr-browser-server-variants");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const serverPath = path.join(srcDir, "entry.server.js");
  const clientPath = path.join(srcDir, "entry.client.js");
  await fs.writeFile(
    path.join(srcDir, "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" />',
  );
  await fs.writeFile(path.join(srcDir, "value.js"), `export default "shared";`);
  await fs.writeFile(
    path.join(srcDir, "bridge.js"),
    `export { default as logo } from "./logo.svg";
export { default as value } from "./value.js";`,
  );
  const entrySource = `import { logo, value } from "./bridge.js";
export const result = { logo, value };`;
  await fs.writeFile(serverPath, entrySource);
  await fs.writeFile(clientPath, entrySource);

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: {
        server: { conditions: ["node"], target: "node" },
        client: { conditions: ["browser"], target: "browser" },
      },
      entries: [
        { id: "server", path: serverPath, envs: ["server"] },
        { id: "client", path: clientPath, envs: ["client"] },
      ],
      outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: false },
    },
    [],
  );

  const serverBundle = result.entrypoints[`server:${serverPath}`];
  const clientBundle = result.entrypoints[`client:${clientPath}`];
  const serverCode = await fs.readFile(
    path.join(outDir, serverBundle.fileName),
    "utf8",
  );
  const clientCode = await fs.readFile(
    path.join(outDir, clientBundle.fileName),
    "utf8",
  );
  const serverUrl = pathToFileURL(
    path.join(outDir, serverBundle.fileName),
  ).href;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const loaded = await import(${JSON.stringify(serverUrl)}); console.log(JSON.stringify(loaded.result));`,
  ]);
  const loadedResult = JSON.parse(stdout);

  expect(loadedResult).toEqual({
    logo: expect.objectContaining({
      src: expect.stringMatching(/^\/assets\//),
    }),
    value: "shared",
  });
  expect(serverCode).not.toContain("__BUNDLER_HMR__.register");
  expect(serverCode).toMatch(/const [a-z0-9]+_default = \{/);
  expect(clientCode).toContain("__BUNDLER_HMR__.register");
  expect(
    result.bundles.some(
      (bundle) =>
        bundle.entryId.startsWith("bundler:hmr-runtime:") &&
        bundle.environmentIds.includes("server"),
    ),
  ).toBe(false);
});

test("dev hmr applies fetched patches inside the owning bundle scope", async () => {
  const outDir = path.join(outRoot, "hmr-lexical-patch");
  const result = await buildFixture("simple", {
    outputs: {
      outDir,
      fileName: "hmr-lexical.[env].[hash].js",
    },
    dev: { hmr: true, reactRefresh: false },
  });
  const bundle = result.bundles.find(
    (candidate) => !candidate.entryId.startsWith("bundler:hmr-runtime:"),
  );
  const bundleKey = `${bundle.scopeIds[0]}:${bundle.entryId}`;
  const cell = result.hmr.bundles[bundleKey].cells.find((candidate) =>
    candidate.symbols.some((symbol) => symbol.endsWith("_value")),
  );
  const symbol = cell.symbols.find((candidate) => candidate.endsWith("_value"));
  const patchCode = await materializeHmrPatch({
    ...cell,
    hash: "patched",
    code: `${symbol} = 42;`,
    artifactPath: undefined,
    map: undefined,
    mapArtifactPath: undefined,
  });
  const bundleUrl = pathToFileURL(path.join(outDir, bundle.fileName)).href;
  const script = `
    let reloads = 0;
    globalThis.WebSocket = undefined;
    globalThis.fetch = async () => new Response(${JSON.stringify(patchCode)});
    globalThis.location = { reload: () => { reloads += 1; } };
    const module = await import(${JSON.stringify(bundleUrl)});
    const before = module.value;
    await globalThis.__BUNDLER_HMR__.applyPatch(
      [{ bundleKey: ${JSON.stringify(bundleKey)}, url: "/__bundler_hmr_updates/1/patch.js" }],
      [],
      []
    );
    console.log(JSON.stringify({ before, after: module.value, reloads }));
    process.exit(0);
  `;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    script,
  ]);
  expect(JSON.parse(stdout)).toEqual({ before: 3, after: 42, reloads: 1 });
});

test("dev hmr manifest size does not scale with source payload size", async () => {
  const projectDir = path.join(outRoot, "hmr-large-manifest");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const cacheDir = path.join(projectDir, ".cache");
  const payload = "x".repeat(512 * 1024);
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "index.js"),
    `export const payload = ${JSON.stringify(payload)};`,
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "large", path: path.join(srcDir, "index.js") }],
      outputs: {
        outDir,
        fileName: "large.[env].[hash].js",
        manifestFile: "manifest.json",
      },
      cacheDir,
      css: false,
      maxWorkers: 1,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: false },
    },
    [],
  );
  const manifest = await fs.readFile(path.join(outDir, "manifest.json"));
  const applicationBundle = result.bundles.find(
    (bundle) => !bundle.entryId.startsWith("bundler:hmr-runtime:"),
  );
  const bundle = await fs.readFile(
    path.join(outDir, applicationBundle.fileName),
  );

  expect(bundle.byteLength).toBeGreaterThan(payload.length);
  expect(manifest.byteLength).toBeLessThan(20_000);
  expect(result.manifest.metadata.hmr).toBeUndefined();
  expect(result.hmr.bundles).toBeDefined();
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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
    result.hmr.bundles[
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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
    result.hmr.bundles[
      `${result.bundles[0].envId}:${result.bundles[0].entryId}`
    ];
  const usedCell = hmrBundle.cells.find((cell) =>
    cell.symbols.some((symbol) => symbol.endsWith("_Used")),
  );

  expect(output).toContain("_Used");
  expect(output).toContain("reactRefreshRegister");
  expect(output).not.toContain("_Unused");
  expect(usedCell).toBeDefined();
  expect(usedCell.artifactPath ?? usedCell.code).toBeDefined();
});

test("dev react refresh records default component exports in HMR patches", async () => {
  const projectDir = path.join(outRoot, "react-refresh-default-patch");
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
    `export default function Dashboard() { return null; }`,
  );

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [
        { id: "react-refresh-default", path: path.join(srcDir, "index.js") },
      ],
      outputs: { outDir, fileName: "react-refresh-default.[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 1,
      diagnostics: "human",
      dev: { hmr: true, reactRefresh: true },
    },
    [],
  );
  const applicationBundle = result.bundles.find(
    (bundle) => !bundle.entryId.startsWith("bundler:"),
  );
  const hmrBundle =
    result.hmr.bundles[
      `${applicationBundle.envId}:${applicationBundle.entryId}`
    ];
  const componentCell = hmrBundle.cells.find(
    (cell) => cell.refreshSymbols?.length > 0,
  );
  const patch = await materializeHmrPatch(componentCell);

  expect(componentCell.refreshSymbols).toEqual(componentCell.symbols);
  expect(patch).toContain(`reactRefreshRegister(${componentCell.symbols[0]}`);
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
        targets: { browser: { platform: "browser" } },
        environments: { browser: {} },
        entries: [{ path: ${JSON.stringify(path.join(fixturesDir, "simple", "src/index.js"))}, environment: "browser", targets: ["browser"] }],
        outputs: { outDir: ${JSON.stringify(outDir)}, fileName: "cli.[environment].[hash].js", manifestFile: "manifest.json" },
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
      targets: { browser: { platform: "browser" } },
      environments: { browser: {} },
      entries: [{ path: ${JSON.stringify(path.join(fixturesDir, "simple", "src/index.js"))}, environment: "browser", targets: ["browser"] }],
      outputs: { outDir: ${JSON.stringify(outDir)}, fileName: "explicit.[environment].[hash].js", manifestFile: "manifest.json" },
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
            return request === "./foo.js" ? { preserve: true } : undefined;
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
  expect(ssrCode).toMatch(
    /import \{ foo as [a-z0-9]+_foo \} from "\.\/foo\.js";/,
  );
  expect(ssrCode).toContain("globalThis.__SIDE_EFFECT__ = true;");
});

test("uses client and server file suffixes to prune bundles by target", async () => {
  const projectDir = path.join(outRoot, "target-suffix-entries");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const clientEntry = path.join(srcDir, "dashboard.client.js");
  const serverEntry = path.join(srcDir, "dashboard.server.js");
  await fs.writeFile(clientEntry, `export const runtime = "browser";`);
  await fs.writeFile(serverEntry, `export const runtime = "node";`);

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: {
        client: { conditions: ["browser"], target: "browser" },
        server: { conditions: ["node"], target: "node" },
      },
      entries: [
        { id: "dashboard-client", path: clientEntry },
        { id: "dashboard-server", path: serverEntry },
      ],
      outputs: {
        outDir,
        fileName: "[entry].[env].[hash].js",
      },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );

  expect(
    result.bundles.map((bundle) => ({
      envId: bundle.envId,
      entryId: path.basename(bundle.entryId),
    })),
  ).toEqual([
    { envId: "client", entryId: "dashboard.client.js" },
    { envId: "server", entryId: "dashboard.server.js" },
  ]);
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
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
              ? { preserve: true }
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

test("rejects load hooks and redirects resolver requests to real files", async () => {
  const fixtureName = "plugin-virtual";
  const realPath = path.join(fixturesDir, fixtureName, "src/real-msg.js");
  const cacheDir = path.join(cacheRoot, fixtureName);
  await fs.rm(cacheDir, { recursive: true, force: true });

  await expect(
    buildFixture(fixtureName, {
      configPlugins: [
        {
          name: "removed-loader",
          load() {
            return { code: "export const msg = 'virtual'" };
          },
        },
      ],
    }),
  ).rejects.toThrow("removed 'load' hook");

  const result = await buildFixture(fixtureName, {
    cacheDir,
    configPlugins: [
      {
        name: "real-file-redirect",
        resolveImport: async ({ request }) => {
          "virtual-resolve-v1";
          return request === "virtual:msg"
            ? { id: realPath, filePath: realPath }
            : undefined;
        },
      },
    ],
  });

  const output = await readBundle(result, fixtureName);
  expect(output).toContain('"hello from a real file"');
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

test("keeps parent chunks split when dependency chunk variants differ", async () => {
  const projectDir = path.join(outRoot, "dependency-variant-linking");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const parentPath = path.join(srcDir, "parent.js");
  const childPath = path.join(srcDir, "child.js");
  await fs.writeFile(
    parentPath,
    `import { child } from "./child.js"; export const parent = child;`,
  );
  await fs.writeFile(childPath, `export const child = "__TOKEN__";`);
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/env-transform-plugin.mjs",
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: {
        client: { conditions: ["browser"], target: "browser" },
        server: { conditions: ["node"], target: "node" },
      },
      entries: [
        { id: "parent", path: parentPath },
        { id: "child", path: childPath },
      ],
      outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          __bundlerPluginRef: true,
          module: pluginModule,
          options: { defaultValue: "server", clientValue: "client" },
        },
      ],
    },
    [],
  );

  expect(result.bundles).toHaveLength(4);
  expect(
    result.bundles.every((bundle) => bundle.environmentIds.length === 1),
  ).toBe(true);
  for (const envId of ["client", "server"]) {
    const parentEntry = result.entrypoints[`${envId}:${parentPath}`];
    const childEntry = result.entrypoints[`${envId}:${childPath}`];
    const parentCode = await fs.readFile(
      path.join(outDir, parentEntry.fileName),
      "utf8",
    );
    expect(parentCode).toContain(`from "./${childEntry.fileName}"`);
  }
});

test("runs declared environment-independent Babel stages once", async () => {
  const projectDir = path.join(outRoot, "environment-independent-transform");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const sharedPath = path.join(srcDir, "shared.js");
  const bridgePath = path.join(srcDir, "bridge.js");
  const clientPath = path.join(srcDir, "app.client.js");
  const serverPath = path.join(srcDir, "app.server.js");
  const countFile = path.join(projectDir, "transform-count.txt");
  await fs.writeFile(sharedPath, `export const shared = "once";`);
  await fs.writeFile(bridgePath, `export { shared } from "./shared.js";`);
  await fs.writeFile(
    clientPath,
    `import { shared } from "./shared.js"; export const client = shared;`,
  );
  await fs.writeFile(
    serverPath,
    `import { shared } from "./bridge.js"; export const server = shared;`,
  );
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/environment-independent-plugin.mjs",
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: {
        server: { conditions: ["node"], target: "node" },
        client: { conditions: ["browser"], target: "browser" },
      },
      entries: [
        { id: "client", path: clientPath, envs: ["client"] },
        { id: "server", path: serverPath, envs: ["server"] },
      ],
      outputs: {
        outDir,
        fileName: "environment-independent.[entry].[env].[hash].js",
      },
      cacheDir: path.join(projectDir, ".cache"),
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          __bundlerPluginRef: true,
          module: pluginModule,
          options: { countFile },
        },
      ],
    },
    [],
  );

  expect(result.bundles).toHaveLength(2);
  expect(
    result.bundles
      .filter((bundle) => bundle.environmentIds.length === 1)
      .map((bundle) => bundle.environmentIds[0])
      .sort(),
  ).toEqual(["client", "server"]);
  expect(
    result.bundles.some((bundle) => bundle.environmentIds.length > 1),
  ).toBe(false);
  expect((await fs.readFile(countFile, "utf8")).trim().split("\n")).toEqual([
    "shared",
  ]);
});

test("groups compatible modules with manualChunk", async () => {
  const projectDir = path.join(outRoot, "manual-chunk");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "first.js"),
    `import { a } from "./a.js"; export const first = a;`,
  );
  await fs.writeFile(
    path.join(srcDir, "second.js"),
    `import { b } from "./b.js"; export const second = b;`,
  );
  await fs.writeFile(path.join(srcDir, "a.js"), `export const a = "a";`);
  await fs.writeFile(path.join(srcDir, "b.js"), `export const b = "b";`);

  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [
        { id: "first", path: path.join(srcDir, "first.js") },
        { id: "second", path: path.join(srcDir, "second.js") },
      ],
      outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          name: "manual-vendor",
          manualChunk(moduleInfo) {
            "manual-vendor-v1";
            return /[/\\][ab]\.js$/.test(moduleInfo.filePath)
              ? "vendor"
              : undefined;
          },
        },
      ],
    },
    [],
  );

  const manualBundle = result.bundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:manual:manual-vendor:vendor"),
  );
  expect(manualBundle).toBeDefined();
  expect(
    manualBundle.modules
      .map((id) => path.basename(stripEnvironmentIdentity(id)))
      .sort(),
  ).toEqual(["a.js", "b.js"]);
  for (const entryName of ["first.js", "second.js"]) {
    const entryBundle = result.bundles.find((bundle) =>
      bundle.entryId.endsWith(entryName),
    );
    const code = await fs.readFile(
      path.join(outDir, entryBundle.fileName),
      "utf8",
    );
    expect(code).toContain(`from "./${manualBundle.fileName}"`);
  }
});

test("rejects manualChunk groups with incompatible environment variants", async () => {
  const projectDir = path.join(outRoot, "manual-chunk-incompatible");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "client.js"),
    `import { shared } from "./universal.js"; import { scoped } from "./scoped.js"; export const value = shared + scoped;`,
  );
  await fs.writeFile(
    path.join(srcDir, "server.js"),
    `import { shared } from "./universal.js"; import { scoped } from "./scoped.js"; export const value = shared + scoped;`,
  );
  await fs.writeFile(
    path.join(srcDir, "universal.js"),
    `export const shared = "shared";`,
  );
  await fs.writeFile(
    path.join(srcDir, "scoped.js"),
    `export const scoped = "__TOKEN__";`,
  );
  const envTransformPlugin = path.join(
    rootDir,
    "packages/bundler/test/plugins/env-transform-plugin.mjs",
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);

  await expect(
    buildProject(
      {
        envs: {
          client: { conditions: ["browser"], target: "browser" },
          server: { conditions: ["node"], target: "node" },
        },
        entries: [
          {
            id: "client",
            path: path.join(srcDir, "client.js"),
            envs: ["client"],
          },
          {
            id: "server",
            path: path.join(srcDir, "server.js"),
            envs: ["server"],
          },
        ],
        outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
        plugins: [
          {
            __bundlerPluginRef: true,
            module: envTransformPlugin,
            options: { defaultValue: "server", clientValue: "client" },
          },
          {
            name: "manual-incompatible",
            manualChunk(moduleInfo) {
              "manual-incompatible-v1";
              return /[/\\](?:universal|scoped)\.js$/.test(moduleInfo.filePath)
                ? "vendor"
                : undefined;
            },
          },
        ],
      },
      [],
    ),
  ).rejects.toThrow("incompatible module variants");
});

test("rejects manualChunk groups with incompatible dependency links", async () => {
  const projectDir = path.join(outRoot, "manual-chunk-link-incompatible");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const rootPath = path.join(srcDir, "root.js");
  const wrapperPath = path.join(srcDir, "wrapper.js");
  const childPath = path.join(srcDir, "child.js");
  await fs.writeFile(
    rootPath,
    `import { wrapper } from "./wrapper.js"; export const root = wrapper;`,
  );
  await fs.writeFile(
    wrapperPath,
    `import { child } from "./child.js"; export const wrapper = child;`,
  );
  await fs.writeFile(childPath, `export const child = "__TOKEN__";`);
  const envTransformPlugin = path.join(
    rootDir,
    "packages/bundler/test/plugins/env-transform-plugin.mjs",
  );
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);

  await expect(
    buildProject(
      {
        envs: {
          client: { conditions: ["browser"], target: "browser" },
          server: { conditions: ["node"], target: "node" },
        },
        entries: [
          { id: "root", path: rootPath },
          { id: "child", path: childPath },
        ],
        outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
        cacheDir: path.join(projectDir, ".cache"),
        css: false,
        maxWorkers: 2,
        diagnostics: "human",
        plugins: [
          {
            __bundlerPluginRef: true,
            module: envTransformPlugin,
            options: { defaultValue: "server", clientValue: "client" },
          },
          {
            name: "manual-link-incompatible",
            manualChunk(moduleInfo) {
              "manual-link-incompatible-v1";
              return moduleInfo.filePath === wrapperPath
                ? "wrapper"
                : undefined;
            },
          },
        ],
      },
      [],
    ),
  ).rejects.toThrow("incompatible module variants");
});

test("changes importer hashes when generated dependency imports change", async () => {
  const projectDir = path.join(outRoot, "dependency-hash");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const cacheDir = path.join(projectDir, ".cache");
  const entryPath = path.join(srcDir, "entry.js");
  const dependencyPath = path.join(srcDir, "dependency.js");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    entryPath,
    `import { dependency } from "./dependency.js"; export const value = dependency;`,
  );
  await fs.writeFile(dependencyPath, `export const dependency = 1;`);
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const config = {
    envs: { browser: { conditions: ["default"], target: "browser" } },
    entries: [
      { id: "entry", path: entryPath },
      { id: "dependency", path: dependencyPath },
    ],
    outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
    cacheDir,
    css: false,
    maxWorkers: 2,
    diagnostics: "human",
  };
  const first = await buildProject(config, []);
  const firstEntry = first.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );
  const firstDependency = first.bundles.find(
    (bundle) => bundle.entryId === dependencyPath,
  );

  await fs.writeFile(dependencyPath, `export const dependency = 2;`);
  const second = await buildProject(config, []);
  const secondEntry = second.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );
  const secondDependency = second.bundles.find(
    (bundle) => bundle.entryId === dependencyPath,
  );
  const secondEntryCode = await fs.readFile(
    path.join(outDir, secondEntry.fileName),
    "utf8",
  );

  expect(secondDependency.fileName).not.toBe(firstDependency.fileName);
  expect(secondEntry.fileName).not.toBe(firstEntry.fileName);
  expect(secondEntryCode).toContain(`from "./${secondDependency.fileName}"`);
});

test("keeps existing bundle ids stable when an unrelated plan is added", async () => {
  const projectDir = path.join(outRoot, "unrelated-plan-stability");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const firstPath = path.join(srcDir, "first.js");
  const unrelatedPath = path.join(srcDir, "unrelated.js");
  await fs.writeFile(firstPath, `export const first = 1;`);
  await fs.writeFile(unrelatedPath, `export const unrelated = 2;`);
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const createConfig = (entries) => ({
    targets: { browser: { platform: "browser" } },
    environments: { app: {} },
    entries: entries.map((entryPath) => ({
      path: entryPath,
      environment: "app",
      targets: ["browser"],
    })),
    outputs: { outDir, fileName: "[entry].[hash].js" },
    cacheDir: path.join(projectDir, ".cache"),
    css: false,
    maxWorkers: 2,
    diagnostics: "human",
  });

  const first = await buildProject(createConfig([firstPath]), []);
  const second = await buildProject(
    createConfig([firstPath, unrelatedPath]),
    [],
  );
  const original = first.bundles.find((bundle) => bundle.entryId === firstPath);
  const retained = second.bundles.find(
    (bundle) => bundle.entryId === firstPath,
  );

  expect(retained.id).toBe(original.id);
  expect(retained.fileName).toBe(original.fileName);
});

test("changes bundle hashes when linked resource contents change", async () => {
  const projectDir = path.join(outRoot, "resource-hash");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const entryPath = path.join(srcDir, "index.js");
  const stylePath = path.join(srcDir, "theme.css");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    entryPath,
    `import "./theme.css"; export const value = 1;`,
  );
  await fs.writeFile(stylePath, `body { color: red; }`);
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const config = {
    envs: { browser: { conditions: ["default"], target: "browser" } },
    entries: [{ id: "index", path: entryPath }],
    outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
    cacheDir: path.join(projectDir, ".cache"),
    maxWorkers: 2,
    diagnostics: "human",
  };
  const first = await buildProject(config, []);
  const firstStyle = first.manifest.assets.find(
    (asset) => asset.type === "style",
  );

  await fs.writeFile(stylePath, `body { color: blue; }`);
  const second = await buildProject(config, []);
  const secondStyle = second.manifest.assets.find(
    (asset) => asset.type === "style",
  );

  expect(secondStyle.fileName).not.toBe(firstStyle.fileName);
  expect(second.bundles[0].fileName).not.toBe(first.bundles[0].fileName);
});

test("exposes final bundle filenames only after resource hashing", async () => {
  const projectDir = path.join(outRoot, "resource-final-filename");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const entryPath = path.join(srcDir, "index.js");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(entryPath, `export const value = 1;`);
  let resourceBundles;
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "index", path: entryPath }],
      outputs: { outDir, fileName: "[entry].[scope].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          name: "resource-final-filename",
          generateBundleResources({ bundles, emitFile }) {
            "resource-final-filename-v1";
            resourceBundles = structuredClone(bundles);
            emitFile({
              fileName: "resource.txt",
              contents: "resource bytes",
              bundleKey: bundles[0].id,
            });
          },
          buildEnd({ bundles, emitFile }) {
            "resource-final-filename-build-end-v1";
            emitFile({
              fileName: "bundle-names.json",
              type: "manifest",
              contents: JSON.stringify(
                bundles.map((bundle) => bundle.fileName),
              ),
            });
          },
        },
      ],
    },
    [],
  );

  expect(resourceBundles[0]).not.toHaveProperty("fileName");
  const referencedNames = JSON.parse(
    await fs.readFile(path.join(outDir, "bundle-names.json"), "utf8"),
  );
  expect(referencedNames).toEqual(
    result.bundles.map((bundle) => bundle.fileName),
  );
  await expect(fs.access(path.join(outDir, referencedNames[0]))).resolves.toBe(
    undefined,
  );
});

test("changes bundle hashes when linked source maps change", async () => {
  const projectDir = path.join(outRoot, "source-map-hash");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const entryPath = path.join(srcDir, "index.js");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(entryPath, `export const value = 1;`);
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const createMapPlugin = (label) => ({
    name: `source-map-${label}`,
    afterCombine: [
      ({ code, map }) => {
        "source-map-hash-v1";
        return {
          code,
          map: JSON.stringify({ ...JSON.parse(map), x_test_label: label }),
        };
      },
    ],
  });
  const config = {
    envs: { browser: { conditions: ["default"], target: "browser" } },
    entries: [{ id: "index", path: entryPath }],
    outputs: {
      outDir,
      fileName: "[entry].[scope].[hash].js",
      sourceMap: "external",
    },
    cacheDir: path.join(projectDir, ".cache"),
    css: false,
    maxWorkers: 2,
    diagnostics: "human",
  };
  const first = await buildProject(
    { ...config, plugins: [createMapPlugin("first")] },
    [],
  );
  const second = await buildProject(
    { ...config, plugins: [createMapPlugin("second")] },
    [],
  );

  expect(second.bundles[0].fileName).not.toBe(first.bundles[0].fileName);
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
  const countFile = path.join(projectDir, "transform-count.txt");
  const { buildProject: rawBuildProject } = await import("../dist/builder.js");
  const buildProject = withTestConfig(rawBuildProject);
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: [{ id: "index", path: path.join(srcDir, "index.js") }],
      outputs: { outDir, fileName: "[entry].[env].[hash].js" },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins: [
        {
          __bundlerPluginRef: true,
          module: pluginModule,
          options: { countFile },
        },
      ],
    },
    [],
  );

  expect(result.manifest.bundles[0].modules).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/[/\\]index\.js::environment=browser$/),
      expect.stringMatching(/[/\\]dependency\.js::environment=browser$/),
    ]),
  );
  const bundleUrl = new URL(
    result.bundles[0].fileName,
    pathToFileURL(`${outDir}${path.sep}`),
  );
  await expect(import(bundleUrl.href)).resolves.toMatchObject({ value: 42 });
  await expect(fs.readFile(countFile, "utf8")).resolves.toBe("transform\n");
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
        type: "test-json",
        file: path.join(fixturesDir, "simple", "src/index.js"),
      }),
    ]),
  );
});

test("collects typed StyleX metadata and generates bundle CSS", async () => {
  const outDir = path.join(outRoot, "stylex-basic");
  const result = await buildFixture("stylex-basic", {
    outputs: {
      outDir,
      fileName: "stylex-basic.[env].[hash].js",
      sourceMap: "external",
    },
    configPlugins: [
      {
        __bundlerPluginRef: true,
        module: path.join(rootDir, "packages/stylex-plugin/bundler.mjs"),
        options: { dev: false, rootDir },
      },
    ],
  });

  const style = result.manifest.assets.find((asset) => asset.type === "style");
  expect(style).toBeDefined();
  expect(style).toMatchObject({
    bundleKey: "stylex:global",
    global: true,
  });
  const css = await fs.readFile(path.join(outDir, style.fileName), "utf8");
  expect(css).toContain("rgb(190,40,60)");
  expect(css).toContain("padding:12px");
  expect(css).toContain(
    `sourceMappingURL=${path.basename(style.fileName)}.map`,
  );
  await expect(
    fs.stat(path.join(outDir, `${style.fileName}.map`)),
  ).resolves.toBeDefined();

  const bundle = result.bundles[0];
  const bundleUrl = pathToFileURL(path.join(outDir, bundle.fileName)).href;
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const mod = await import(${JSON.stringify(bundleUrl)}); console.log(mod.className);`,
  ]);
  expect(stdout.trim()).toMatch(/^x[0-9a-z]+(?: x[0-9a-z]+)*$/);
});

test("collects Tailwind candidates and generates bundle CSS", async () => {
  const outDir = path.join(outRoot, "tailwind-basic");
  const result = await buildFixture("tailwind-basic", {
    outputs: {
      outDir,
      fileName: "tailwind-basic.[env].[hash].js",
      sourceMap: "external",
    },
    configPlugins: [
      {
        __bundlerPluginRef: true,
        module: path.join(rootDir, "packages/tailwind-plugin/bundler.mjs"),
        options: {
          rootDir,
          cssFile: path.join(fixturesDir, "tailwind-basic/src/input.css"),
        },
      },
    ],
  });

  const style = result.manifest.assets.find((asset) => asset.type === "style");
  expect(style).toBeDefined();
  const css = await fs.readFile(path.join(outDir, style.fileName), "utf8");
  expect(css).toContain(".flex");
  expect(css).toContain(".items-center");
  expect(css).toContain(".bg-red-500");
  expect(css).toContain("body");
  expect(css).toContain("margin: 0");
  expect(css).toContain(
    `sourceMappingURL=${path.basename(style.fileName)}.map`,
  );
  await expect(
    fs.stat(path.join(outDir, `${style.fileName}.map`)),
  ).resolves.toBeDefined();
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
          addEntry({
            path: extraEntry,
            environment: "client",
            targets: ["client"],
          });
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

test("afterCombine hooks can replace structured link references", async () => {
  const result = await buildFixture("dynamic-import", {
    configPlugins: [
      {
        name: "rename-link-placeholders",
        afterCombine: [
          ({ code, references }) => {
            "rename-link-placeholders-v1";
            let nextCode = code;
            const nextReferences = references.map((reference) => {
              if (
                reference.kind !== "output-url" ||
                typeof reference.symbol !== "string"
              ) {
                return reference;
              }
              const symbol = `${reference.symbol}_after_combine`;
              nextCode = nextCode.replaceAll(reference.symbol, symbol);
              return { ...reference, symbol };
            });
            return { code: nextCode, references: nextReferences };
          },
        ],
      },
    ],
  });
  const entryPath = path.join(fixturesDir, "dynamic-import", "src/index.js");
  const entryBundle = result.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );
  const bundlePath = path.join(outRoot, "dynamic-import", entryBundle.fileName);
  const code = await fs.readFile(bundlePath, "utf8");

  expect(code).toContain("_after_combine");
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const namespace = await import(${JSON.stringify(
      `${pathToFileURL(bundlePath).href}?after-combine-references`,
    )}); console.log(await namespace.loadFoo());`,
  ]);
  expect(stdout.trim()).toBe("42");
});

test("executes dynamically imported bundles with the expected exports", async () => {
  const entryPath = path.join(fixturesDir, "dynamic-import", "src/index.js");
  const result = await buildFixture("dynamic-import");
  const bundleDir = path.join(outRoot, "dynamic-import");
  const entryBundle = result.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );
  const dynamicBundle = result.bundles.find(
    (bundle) => bundle.entryKind === "dynamic",
  );

  expect(entryBundle).toBeDefined();
  expect(entryBundle.entryKind).toBe("explicit");
  expect(dynamicBundle).toBeDefined();
  expect(
    result.manifest.dynamicImports[
      `${dynamicBundle.envId}:${dynamicBundle.entryId}`
    ],
  ).toBe(dynamicBundle.fileName);

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
