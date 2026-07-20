import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { buildProject } from "../dist/index.js";

const rootDir = path.resolve(process.cwd());
const outRoot = path.join(rootDir, "test/.out/wasm");
const importedFunctionWasm = Buffer.from(
  "0061736d0100000001060160017f017f020e0103656e76066f6666736574000003020100070d01096164644f666673657400010a08010600200010000b",
  "hex",
);

beforeEach(async () => {
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });
});

test("instantiates emitted Wasm in browser and Node runtimes", async () => {
  const projectDir = await createProject("runtimes", {
    "src/index.js": `
import initFromQuery from "./math.wasm?init";
import initFromAttribute from "./math.wasm" with { as: "wasm" };
import wasmUrl from "./math.wasm";

export { wasmUrl };
export async function calculate(value, offset) {
  const imports = { env: { offset: (input) => input + offset } };
  const fromQuery = await initFromQuery(imports);
  const fromAttribute = await initFromAttribute(imports);
  return {
    query: fromQuery.exports.addOffset(value),
    attribute: fromAttribute.exports.addOffset(value),
    distinct: fromQuery !== fromAttribute,
  };
}
`,
    "src/math.wasm": importedFunctionWasm,
  });
  const config = createConfig(projectDir);
  config.outputs.rootURL = "/cdn/";
  const first = await buildProject(config, []);
  const firstEntryBundles = entryBundles(first, config.entries[0].path);
  const nodeBundle = findTargetBundle(firstEntryBundles, "node");
  const browserBundle = findTargetBundle(firstEntryBundles, "browser");
  const wasmAssets = first.manifest.assets.filter(
    (asset) => asset.type === "asset" && asset.fileName.endsWith(".wasm"),
  );

  expect(wasmAssets).toHaveLength(1);
  expect(wasmAssets[0].contentType).toBe("application/wasm");
  await expect(
    fs.readFile(path.join(config.outputs.outDir, wasmAssets[0].fileName)),
  ).resolves.toEqual(importedFunctionWasm);

  const nodeNamespace = await import(
    `${pathToFileURL(path.join(config.outputs.outDir, nodeBundle.fileName)).href}?test=node`
  );
  await expect(nodeNamespace.calculate(7, 5)).resolves.toEqual({
    query: 12,
    attribute: 12,
    distinct: true,
  });
  expect(nodeNamespace.wasmUrl).toBe(`/cdn/${wasmAssets[0].fileName}`);

  let fetches = 0;
  let fetchedUrl;
  const fetch = async (url) => {
    fetches += 1;
    fetchedUrl = url.href;
    return new Response(importedFunctionWasm, {
      headers: { "content-type": "application/wasm" },
    });
  };
  const browserCode = await fs.readFile(
    path.join(config.outputs.outDir, browserBundle.fileName),
    "utf8",
  );
  const browserModule = new vm.SourceTextModule(browserCode, {
    context: vm.createContext({ fetch, URL, WebAssembly }),
    identifier: `https://example.test/static/${browserBundle.fileName}`,
    initializeImportMeta(meta, module) {
      meta.url = module.identifier;
    },
  });
  await browserModule.link(() => {
    throw new Error("The single-entry Wasm fixture should not have imports.");
  });
  await browserModule.evaluate();
  await expect(browserModule.namespace.calculate(7, 5)).resolves.toEqual({
    query: 12,
    attribute: 12,
    distinct: true,
  });
  expect(fetches).toBe(1);
  expect(fetchedUrl).toBe(`https://example.test/cdn/${wasmAssets[0].fileName}`);

  await fs.writeFile(
    path.join(projectDir, "src/math.wasm"),
    Buffer.concat([
      importedFunctionWasm,
      Buffer.from([0x00, 0x03, 0x01, 0x78, 0x01]),
    ]),
  );
  const second = await buildProject(config, []);
  const secondAsset = second.manifest.assets.find(
    (asset) => asset.type === "asset" && asset.fileName.endsWith(".wasm"),
  );
  expect(secondAsset.fileName).not.toBe(wasmAssets[0].fileName);
  for (const targetId of ["browser", "node"]) {
    expect(
      findTargetBundle(entryBundles(second, config.entries[0].path), targetId)
        .fileName,
    ).not.toBe(findTargetBundle(firstEntryBundles, targetId).fileName);
  }
});

test("rejects an invalid Wasm header during the build", async () => {
  const projectDir = await createProject("invalid", {
    "src/index.js": 'import init from "./invalid.wasm?init"; export { init };',
    "src/invalid.wasm": Buffer.from("not wasm"),
  });

  await expect(buildProject(createConfig(projectDir), [])).rejects.toThrow(
    "E_WASM_INVALID_HEADER",
  );
});

function createConfig(projectDir) {
  const entryPath = path.join(projectDir, "src/index.js");
  return {
    targets: {
      browser: { platform: "browser" },
      node: { platform: "node" },
    },
    environments: { app: {} },
    entries: [
      {
        path: entryPath,
        environment: "app",
        targets: ["browser", "node"],
      },
    ],
    outputs: {
      outDir: path.join(projectDir, "dist"),
      fileName: "[entry].[target].[environment].[hash].js",
    },
    cacheDir: path.join(projectDir, ".cache"),
    maxWorkers: 2,
    diagnostics: "human",
  };
}

async function createProject(name, files) {
  const projectDir = path.join(outRoot, name);
  await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name: `wasm-${name}`,
      version: "1.0.0",
      type: "module",
    }),
  );
  await Promise.all(
    Object.entries(files).map(async ([fileName, contents]) => {
      const filePath = path.join(projectDir, fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents);
    }),
  );
  return projectDir;
}

function entryBundles(result, entryPath) {
  return result.bundles.filter((bundle) =>
    bundle.entrypoints.some((entrypoint) => entrypoint.entryId === entryPath),
  );
}

function findTargetBundle(bundles, targetId) {
  const bundle = bundles.find((candidate) =>
    candidate.targetIds.includes(targetId),
  );
  if (!bundle) {
    throw new Error(`Missing entry bundle for target '${targetId}'.`);
  }
  return bundle;
}
