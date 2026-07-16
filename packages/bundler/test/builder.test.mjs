import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  contentHash,
  findPkgRoot,
  packagePathIdentity,
  readPkgSafe,
} from "@bundler/shared";
import { materializeHmrPatch } from "../dist/dev/hmr-linker.js";

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
      transforms: options.transforms,
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

test("coalesces shared modules into one stable common bundle in development and production", async () => {
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

  const { buildProject } = await import("../dist/builder.js");
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

  expect(moduleOwners(development)).toEqual(moduleOwners(production));
  expect(production.bundles).toHaveLength(4);
  expect(development.bundles).toHaveLength(5);
  expect(
    production.bundles.filter((bundle) =>
      bundle.entryId.startsWith("bundler:common:"),
    ),
  ).toHaveLength(1);
  expect(moduleOwners(production)[path.join(srcDir, "shared-all.js")]).toBe(
    "bundler:common:browser",
  );
  expect(moduleOwners(production)[path.join(srcDir, "shared-ab.js")]).toBe(
    "bundler:common:browser",
  );
  expect(moduleOwners(production)[path.join(srcDir, "only-a.js")]).toBe(
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
  "output": "const __bundler_xfjh41avex_asset_url = "/assets/asset.awn9r5lu.svg";

const g2ch9q22_default = {
  src: __bundler_xfjh41avex_asset_url,
  width: 8,
  height: 6
};
const a2i26jx0t_asset = new URL(g2ch9q22_default.src, import.meta.url).href;
export { a2i26jx0t_asset as asset };",
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
      entryId: "index",
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
  const { buildProject } = await import("../dist/builder.js");
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

test("loads a dynamic chunk's CSS before importing its JavaScript", async () => {
  const name = "dynamic-css";
  const result = await buildFixture(name);
  const entry = result.bundles.find((bundle) =>
    bundle.entryId.endsWith("/src/index.js"),
  );
  const code = await fs.readFile(
    path.join(outRoot, name, entry.fileName),
    "utf8",
  );
  const style = result.manifest.assets.find((item) => item.type === "style");
  expect(style).toBeDefined();
  expect(code).toContain("__bundler_load_css__");
  expect(code).toContain(`"/${style.fileName}"`);
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
  const style = result.manifest.assets.find((item) => item.type === "style");
  const code = await fs.readFile(path.join(outDir, entry.fileName), "utf8");
  const css = await fs.readFile(path.join(outDir, style.fileName), "utf8");

  expect(code).toContain(`"https://cdn.example.test/app/${style.fileName}"`);
  expect(css).toMatch(
    /url\("https:\/\/cdn\.example\.test\/app\/assets\/pixel\.[a-z0-9]+\.svg"\)/,
  );
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

test("writes and replaces readable debug transformations, including cache hits", async () => {
  const projectDir = path.join(outRoot, "debug-transformations");
  const cacheDir = path.join(projectDir, ".cache/conditional-bundler");
  const debugDir = path.join(projectDir, ".cache/__DEBUG__");
  await fs.rm(projectDir, { recursive: true, force: true });

  await buildFixture("simple", { cacheDir, debug: true });
  const firstFiles = await fs.readdir(debugDir, { recursive: true });
  const inputFile = firstFiles.find((file) =>
    file.endsWith(
      path.join("src", "index.js", "__intent-module", "browser", "input.js"),
    ),
  );
  const recordFile = firstFiles.find((file) =>
    file.endsWith(
      path.join("src", "index.js", "__intent-module", "browser", "record.json"),
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
      path.join("src", "index.js", "__intent-module", "browser", "record.json"),
    ),
  );
  expect(
    JSON.parse(await fs.readFile(path.join(debugDir, secondRecord), "utf8"))
      .input.cacheHit,
  ).toBe(true);

  await buildFixture("simple", { cacheDir, debug: false });
  await expect(fs.stat(debugDir)).rejects.toThrow();
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
  const moduleFiles = (
    await fs.readdir(path.join(v2Dir, configRoot), {
      recursive: true,
    })
  ).filter((fileName) => fileName.endsWith("module.json"));
  expect(moduleFiles.length).toBeGreaterThan(0);
  const modulePath = path.join(v2Dir, configRoot, moduleFiles[0]);
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
    const { buildProject } = await import("../dist/builder.js");
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
  const symbolCell = hmrBundle.cells.find((cell) => cell.symbols.length > 0);

  expect(output).toContain(
    `import { __BUNDLER_HMR__ } from "./${runtimeBundle.fileName}";`,
  );
  expect(output).toContain("__BUNDLER_HMR__.register");
  expect(output).toContain("__BUNDLER_HMR__.registerBundle");
  expect(output).not.toContain("const __BUNDLER_HMR__");
  expect(runtimeOutput).toContain("const __BUNDLER_HMR__");
  expect(runtimeOutput).toContain('message.type === "rsc-refresh"');
  expect(runtimeOutput).toContain('"bundler:rsc-refresh"');
  expect(output).toContain("let a33jpi1jb_value");
  expect(output).toContain("a33jpi1jb_value = k7isotkd_foo + 1;");
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
  const bundleKey = `${bundle.envId}:${bundle.entryId}`;
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
  const { buildProject } = await import("../dist/builder.js");
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

  const { buildProject } = await import("../dist/builder.js");
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
  expect(ssrCode).toContain('import { foo as a33jpi1jb_foo } from "./foo.js";');
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

  const { buildProject } = await import("../dist/builder.js");
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

test("runs declared environment-independent Babel stages once", async () => {
  const projectDir = path.join(outRoot, "environment-independent-transform");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  const sharedPath = path.join(srcDir, "shared.js");
  const clientPath = path.join(srcDir, "app.client.js");
  const serverPath = path.join(srcDir, "app.server.js");
  await fs.writeFile(sharedPath, `export const shared = "once";`);
  await fs.writeFile(
    clientPath,
    `import { shared } from "./shared.js"; export const client = shared;`,
  );
  await fs.writeFile(
    serverPath,
    `import { shared } from "./shared.js"; export const server = shared;`,
  );
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/environment-independent-plugin.mjs",
  );
  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: {
        server: { conditions: ["node"], target: "node" },
        client: { conditions: ["browser"], target: "browser" },
      },
      entries: [
        { id: "client", path: clientPath },
        { id: "server", path: serverPath },
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
        },
      ],
    },
    [],
  );

  expect(result.bundles.map((bundle) => bundle.envId).sort()).toEqual([
    "client",
    "server",
  ]);
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
      path.join(srcDir, "index.js"),
      path.join(srcDir, "dependency.js"),
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
