import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const exampleDir = path.join(rootDir, "examples/react-rsc-basic");
const sourceMapRegister = "@bundler/react-rsc-plugin/register-source-maps";
const browserCases = [
  {
    id: "1",
    selected: "Chrome browser variant",
    userAgent: "Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36",
  },
  {
    id: "2",
    selected: "Firefox browser variant",
    userAgent: "Mozilla/5.0 Firefox/128.0",
  },
  {
    id: "4",
    selected: "Safari browser variant",
    userAgent: "Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15",
  },
  {
    id: "0",
    selected: "Unknown browser variant",
    userAgent: "curl/8.7.1",
  },
];

jest.setTimeout(120_000);

test("react-rsc-basic production serves hydrated RSC output and source maps", async () => {
  await fs.rm(path.join(exampleDir, ".cache/conditional-bundler"), {
    recursive: true,
    force: true,
  });
  const buildOutput = await execFileAsync(
    "corepack",
    ["pnpm", "run", "build"],
    {
      cwd: exampleDir,
      env: process.env,
      timeout: 60_000,
    },
  );
  expect(
    `${buildOutput.stdout}\n${buildOutput.stderr}`.match(
      /react-dom-client\.production\.js/g,
    ),
  ).toHaveLength(1);

  const manifest = await readManifest();
  expectCjsNodeEnv(manifest, "production");
  const showcaseAssets = await expectShowcaseAssets(manifest);
  const clientReferences = manifest.metadata.rsc.clientReferenceBundles;
  expect(manifest.metadata.rsc.inline).toBe(true);
  await expect(
    fs.access(path.join(exampleDir, "dist/rsc-client-manifest.json")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  const clientBundle = findBundle(manifest, "client");
  const serverBundle = findBundle(manifest, "rsc");
  const clientBundles = manifest.bundles.filter((bundle) =>
    bundleAppliesTo(bundle, "client"),
  );
  const clientBundleFiles = clientBundles
    .map((bundle) => bundle.fileName)
    .sort();
  const commonBundle = clientBundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:shared:"),
  );
  const counterBundle = manifest.bundles.find(
    (bundle) => bundle.id === clientReferences["/src/Counter.jsx"].client,
  );
  const browserStringBundle = manifest.bundles.find(
    (bundle) => bundle.id === clientReferences["/src/BrowserString.jsx"].client,
  );
  const rawCounterCode = await fs.readFile(
    path.join(exampleDir, "dist", counterBundle.fileName),
    "utf8",
  );
  const counterExportName = rawCounterCode.match(
    /export \{ ([a-z0-9]+_Counter)(?:, [^}]*)? \};/,
  )?.[1];

  expect(clientReferences["/src/Counter.jsx"]).toEqual({
    client: expect.any(String),
    server: expect.any(String),
  });
  expect(clientBundleFiles).toHaveLength(2);
  expect(clientBundleFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /^bundler-dynamic-group-[a-z0-9]+\.client\.react\.client\.[a-z0-9]+\.js$/,
      ),
      expect.stringMatching(
        /^bundler-shared-[a-z0-9]+\.client\.react\.client\.[a-z0-9]+\.js$/,
      ),
    ]),
  );
  expect(
    clientBundleFiles.filter((fileName) =>
      fileName.startsWith("bundler-shared-"),
    ),
  ).toHaveLength(1);
  expect(commonBundle).toBeDefined();
  const clientModuleIds = clientBundles.flatMap((bundle) => bundle.modules);
  expect(new Set(clientModuleIds).size).toBe(clientModuleIds.length);
  const commonCode = await fs.readFile(
    path.join(exampleDir, "dist", commonBundle.fileName),
    "utf8",
  );
  expect(commonCode).toContain("ReactSharedInternals");
  for (const logicalId of [
    "/src/BrowserString.jsx",
    "/src/Counter.jsx",
    "/src/DraftPad.jsx",
    "/src/PreferenceSwitch.jsx",
  ]) {
    const referenceBundle = manifest.bundles.find(
      (bundle) => bundle.id === clientReferences[logicalId].client,
    );
    const code = await fs.readFile(
      path.join(exampleDir, "dist", referenceBundle.fileName),
      "utf8",
    );
    expect(code).toContain(
      `from "./${conditionFileName(commonBundle.fileName, "x")}"`,
    );
    if (!bundleHasEntrypoint(referenceBundle, "client.jsx")) {
      expect(code).not.toContain("ReactSharedInternals");
    }
  }
  expect(Object.keys(clientReferences).sort()).toEqual([
    "/src/BrowserString.jsx",
    "/src/Counter.jsx",
    "/src/DraftPad.jsx",
    "/src/PreferenceSwitch.jsx",
  ]);
  expect(
    new Set(
      Object.values(clientReferences).map((reference) => reference.client),
    ).size,
  ).toBe(1);
  expect(counterBundle.entrypoints).toHaveLength(5);
  expect(JSON.stringify(clientReferences)).not.toContain(rootDir);
  expect(counterBundle.conditionNames).toEqual([
    "isChrome",
    "isFirefox",
    "isSafari",
  ]);
  expect(counterExportName).toBeDefined();
  expect(rawCounterCode).not.toMatch(/\bas Counter\b/);
  expect(browserStringBundle.conditionNames).toEqual([
    "isChrome",
    "isFirefox",
    "isSafari",
  ]);
  expect(manifest.metadata.conditions.global).toEqual([
    "isChrome",
    "isFirefox",
    "isSafari",
  ]);
  await expect(
    fs.readFile(path.join(exampleDir, "dist/conditions.json"), "utf8"),
  ).resolves.toBe(
    JSON.stringify(["isChrome", "isFirefox", "isSafari"], null, 2),
  );
  for (const bundle of manifest.bundles) {
    expect(bundle.mapFileName).toBe(`${bundle.fileName}.map`);
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(exampleDir, "dist", bundle.mapFileName),
          "utf8",
        ),
      ),
    ).toMatchObject({
      version: 3,
      file: bundle.fileName,
      sections: expect.any(Array),
    });
  }
  await expectMappedServerStack(serverBundle.fileName);

  await withExampleServer("scripts/start.mjs", {}, async (baseUrl) => {
    const html = await fetchText(`${baseUrl}/`);
    expect(html).toContain(
      "Server components with a conditional client branch.",
    );
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      '<meta name="description" content="A small React Server Components example built with conditional-bundler."/>',
    );
    expect(html).not.toContain("<style>");
    expect(html).toMatch(/<main class="shell [a-z][a-z0-9]{7}">/);
    expect(html).not.toContain("__BUNDLER_RSC_CHUNKS__");
    expect(html).toContain("__BUNDLER_RSC_DATA__");
    expect(html).not.toContain("importmap");
    expect(html).not.toContain("esm.sh");
    expect(html).toContain(
      `<script type="module" src="/${conditionFileName(
        clientBundle.fileName,
        "0",
      )}"></script>`,
    );
    expect(html).toContain(
      `<link rel="stylesheet" href="/${showcaseAssets.style.fileName}"`,
    );

    const clientAsset = await fetchAsset(
      `${baseUrl}/${conditionFileName(clientBundle.fileName, "0")}`,
    );
    expect(clientAsset.contentType).toContain("text/javascript");
    expectNoWebpackRuntime(clientAsset.text);
    expect(clientAsset.text).toContain(
      `//# sourceMappingURL=${clientBundle.mapFileName}`,
    );
    const mapAsset = await fetchAsset(`${baseUrl}/${clientBundle.mapFileName}`);
    expect(mapAsset.contentType).toContain("application/json");
    expect(JSON.parse(mapAsset.text)).toMatchObject({
      version: 3,
      file: clientBundle.fileName,
    });
    const markAsset = await fetchAsset(
      `${baseUrl}/${showcaseAssets.mark.fileName}`,
    );
    expect(markAsset.contentType).toContain("image/svg+xml");
    expect(markAsset.text).toContain("<svg");
    const styleAsset = await fetchAsset(
      `${baseUrl}/${showcaseAssets.style.fileName}`,
    );
    expect(styleAsset.contentType).toContain("text/css");
    expect(styleAsset.text).toContain("outline-offset: 6px");

    const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(flight).toContain("src/Counter.jsx");
    expect(flight).toContain("src/DraftPad.jsx");
    expect(flight).toContain("src/PreferenceSwitch.jsx");
    expect(flight).toContain("src/BrowserString.jsx");
    expect(flight).toContain(
      `["/src/Counter.jsx",["/${conditionFileName(
        counterBundle.fileName,
        "0",
      )}","/${conditionFileName(commonBundle.fileName, "0")}"],"${counterExportName}"]`,
    );
    expect(flight).not.toContain(":E");

    const counterAsset = await fetchAsset(
      `${baseUrl}/${conditionFileName(counterBundle.fileName, "0")}`,
    );
    expect(counterAsset.text).toHaveLength(rawCounterCode.length);
    expect(counterAsset.text).not.toContain("CONDITION_START");
    expect(counterAsset.text).not.toContain("console.log(message);");

    const rawResponse = await fetchWithTimeout(
      `${baseUrl}/${clientBundle.fileName}`,
    );
    expect(rawResponse.status).toBe(404);
    const invalidResponse = await fetchWithTimeout(
      `${baseUrl}/${conditionFileName(clientBundle.fileName, "8")}`,
    );
    expect(invalidResponse.status).toBe(404);

    for (const browser of browserCases) {
      const response = await fetchWithTimeout(`${baseUrl}/`, {
        headers: { "user-agent": browser.userAgent },
      });
      const browserHtml = await response.text();
      expect(response.status).toBe(200);
      expect(browserHtml).toContain(
        `<script type="module" src="/${conditionFileName(
          clientBundle.fileName,
          browser.id,
        )}"></script>`,
      );
      const browserAsset = await fetchAsset(
        `${baseUrl}/${conditionFileName(
          browserStringBundle.fileName,
          browser.id,
        )}`,
      );
      expect(browserAsset.text).toHaveLength(
        (
          await fs.readFile(
            path.join(exampleDir, "dist", browserStringBundle.fileName),
            "utf8",
          )
        ).length,
      );
      expect(browserAsset.text).toContain(browser.selected);
      expect(browserAsset.text).not.toContain("CONDITION_START");
    }
  });
});

test("react-rsc-basic development serves HMR output and linked source maps", async () => {
  await withExampleServer(
    "scripts/dev.mjs",
    { NODE_ENV: "development", BUNDLER_MODE: "development" },
    async (baseUrl) => {
      const html = await fetchText(`${baseUrl}/`);
      expect(html).toContain(
        "Server components with a conditional client branch.",
      );
      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).not.toContain("<style>");
      expect(html).toContain("__BUNDLER_RSC_DATA__");
      expect(html).toContain("Counter.client.react.client.");
      expect(html).toContain("DraftPad.client.react.client.");
      expect(html).toContain("PreferenceSwitch.client.react.client.");
      expect(html).toContain("BrowserString.client.react.client.");
      const styleMatch = html.match(
        /<link rel="stylesheet" href="\/(server\.server\.react\.server\.[a-z0-9]+\.css)"/,
      );
      expect(styleMatch).not.toBeNull();
      const scriptMatch = html.match(
        /<script type="module" src="\/(client\.client\.react\.client\.[a-z0-9]+\.id-0\.js)"><\/script>/,
      );
      expect(scriptMatch).not.toBeNull();

      const clientFileName = scriptMatch[1];
      const rawClientFileName = clientFileName.replace(".id-0.js", ".js");
      const clientAsset = await fetchAsset(`${baseUrl}/${clientFileName}`);
      expect(clientAsset.contentType).toContain("text/javascript");
      expectNoWebpackRuntime(clientAsset.text);
      expect(clientAsset.text).toContain("__BUNDLER_HMR__");
      expect(clientAsset.text).toContain(
        `//# sourceMappingURL=${rawClientFileName}.map`,
      );

      const mapAsset = await fetchAsset(`${baseUrl}/${rawClientFileName}.map`);
      expect(mapAsset.contentType).toContain("application/json");
      expect(JSON.parse(mapAsset.text)).toMatchObject({
        version: 3,
        file: rawClientFileName,
        sections: expect.any(Array),
      });

      const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
      expect(flight).toContain("src/Counter.jsx");
      expect(flight).toContain("src/DraftPad.jsx");
      expect(flight).toContain("src/PreferenceSwitch.jsx");
      expect(flight).toContain("src/BrowserString.jsx");
      expect(flight).not.toContain(":E");

      const manifest = await readManifest();
      expectCjsNodeEnv(manifest, "development");
      const showcaseAssets = await expectShowcaseAssets(manifest);
      expect(styleMatch[1]).toBe(showcaseAssets.style.fileName);
      const markAsset = await fetchAsset(
        `${baseUrl}/${showcaseAssets.mark.fileName}`,
      );
      expect(markAsset.contentType).toContain("image/svg+xml");
      const styleAsset = await fetchAsset(`${baseUrl}/${styleMatch[1]}`);
      expect(styleAsset.contentType).toContain("text/css");
      expect(styleAsset.text).toContain("outline-offset: 6px");
      const clientBundles = manifest.bundles.filter((bundle) =>
        bundleAppliesTo(bundle, "client"),
      );
      const runtimeBundle = clientBundles.find((bundle) =>
        bundle.entryId.startsWith("bundler:hmr-runtime:"),
      );
      const commonBundle = clientBundles.find((bundle) =>
        bundle.entryId.startsWith("bundler:shared:"),
      );
      const clientModuleIds = clientBundles.flatMap((bundle) => bundle.modules);
      expect(new Set(clientModuleIds).size).toBe(clientModuleIds.length);
      expect(runtimeBundle).toBeDefined();
      expect(commonBundle).toBeDefined();
      const clientOutputs = await Promise.all(
        clientBundles.map(async (bundle) => ({
          bundle,
          code: await fs.readFile(
            path.join(exampleDir, "dist", bundle.fileName),
            "utf8",
          ),
        })),
      );
      expect(
        clientOutputs.filter(({ code }) =>
          code.includes("const __BUNDLER_HMR__"),
        ),
      ).toEqual([
        expect.objectContaining({
          bundle: expect.objectContaining({ entryId: runtimeBundle.entryId }),
        }),
      ]);
      for (const { bundle, code } of clientOutputs) {
        if (bundle.entryId === runtimeBundle.entryId) {
          continue;
        }
        expect(code).toContain(
          `from "./${conditionFileName(runtimeBundle.fileName, "x")}"`,
        );
      }
      const serverBundle = findBundle(manifest, "rsc");
      const conditionBundle = manifest.bundles.find(
        (bundle) =>
          bundleAppliesTo(bundle, "client") &&
          bundle.conditionNames?.includes("isChrome"),
      );
      const rawConditionCode = await fs.readFile(
        path.join(exampleDir, "dist", conditionBundle.fileName),
        "utf8",
      );
      const conditionAsset = await fetchAsset(
        `${baseUrl}/${conditionFileName(conditionBundle.fileName, "0")}`,
      );
      expect(conditionAsset.text).toHaveLength(rawConditionCode.length);
      expect(conditionAsset.text).not.toContain("CONDITION_START");
      expect(conditionAsset.text).toContain("Unknown browser variant");
      await expectMappedServerStack(serverBundle.fileName, "?stack-probe=1");
    },
  );
});

async function withExampleServer(script, extraEnv, run) {
  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      sourceMapRegister,
      script,
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        DEV: "0",
        NODE_ENV: script.endsWith("dev.mjs") ? "development" : "production",
        ...extraEnv,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  let exited = false;
  const exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      exited = true;
      resolve({ code, signal });
    });
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(`${baseUrl}/`, () => output);
    await run(baseUrl);
  } finally {
    if (!exited) {
      child.kill(script.endsWith("dev.mjs") ? "SIGINT" : "SIGTERM");
    }
    await exit;
  }
}

async function expectMappedServerStack(fileName, query = "") {
  const specifier = `./dist/${fileName}${query}`;
  const script = `
    globalThis.__BUNDLER_RSC_DEV__ = true;
    import(${JSON.stringify(specifier)}).then(async (module) => {
      try {
        await module.handleBasicRequest({
          response: null,
          url: new URL("http://localhost/")
        });
      } catch (error) {
        console.log(error.stack);
      }
    });
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      sourceMapRegister,
      "-e",
      script,
    ],
    {
      cwd: exampleDir,
      env: { ...process.env, DEV: "0", NODE_ENV: "production" },
      timeout: 10_000,
    },
  );

  expect(stdout).toMatch(
    /bundler:\/react-rsc-basic%400\.1\.0%3A%3Asrc\/server\.jsx:\d+:\d+/,
  );
  expect(stdout).not.toContain(`/dist/${fileName}`);
}

async function readManifest() {
  return JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
}

async function expectShowcaseAssets(manifest) {
  const mark = manifest.assets.find(
    (asset) => asset.type === "asset" && asset.fileName.includes("basic-mark"),
  );
  const texture = manifest.assets.find(
    (asset) =>
      asset.type === "asset" && asset.fileName.includes("basic-texture"),
  );
  const style = manifest.assets.find((asset) => asset.type === "style");
  expect(mark).toBeDefined();
  expect(texture).toBeDefined();
  expect(style).toBeDefined();

  const css = await fs.readFile(
    path.join(exampleDir, "dist", style.fileName),
    "utf8",
  );
  expect(css).toContain(`url("/${texture.fileName}")`);
  expect(css).not.toContain("/assets/assets/");
  expect(css).toContain("@layer example-import");
  expect(css).toContain("outline-offset: 6px");
  expect(css.indexOf("isolation: isolate")).toBeLessThan(
    css.indexOf("position: relative"),
  );
  const assetBackgroundIndex = css.search(
    /background: var\(--[^)]*__finalURL\)/,
  );
  expect(assetBackgroundIndex).toBeGreaterThan(-1);
  expect(css.indexOf("position: relative")).toBeLessThan(assetBackgroundIndex);

  const serverBundle = findBundle(manifest, "rsc");
  const serverCode = await fs.readFile(
    path.join(exampleDir, "dist", serverBundle.fileName),
    "utf8",
  );
  expect(serverCode).toContain(`"/${mark.fileName}"`);
  expect(serverCode).toMatch(
    /src: [a-z0-9]+_default,\s+width: 64,\s+height: 64/,
  );
  return { mark, texture, style };
}

function expectCjsNodeEnv(manifest, expected) {
  const records = Array.from(
    new Set(manifest.bundles.flatMap((bundle) => bundle.modules)),
  ).filter(
    (id) =>
      id.includes("cjs/") &&
      /\.(?:production|development)\.js(?:::environment=|$)/.test(id),
  );
  const opposite = expected === "production" ? "development" : "production";

  expect(records.length).toBeGreaterThan(0);
  expect(records.some((id) => id.includes(`.${expected}.js`))).toBe(true);
  expect(records.some((id) => id.includes(`.${opposite}.js`))).toBe(false);
}

function expectNoWebpackRuntime(code) {
  expect(code).not.toContain("__webpack_require__");
  expect(code).not.toContain("__webpack_chunk_load__");
  expect(code).not.toContain("__webpack_get_script_filename__");
  expect(code).not.toContain("__bundler_rsc_legacy");
  expect(code).not.toContain("webpackGetChunkFilename");
}

function findBundle(manifest, kind) {
  return manifest.bundles.find((bundle) => {
    if (kind === "client") {
      return (
        bundleAppliesTo(bundle, "client") &&
        bundle.environmentIds.includes("react.client") &&
        bundleHasEntrypoint(bundle, "client.jsx")
      );
    }
    return (
      bundleAppliesTo(bundle, "server") &&
      bundle.environmentIds.includes("react.server") &&
      bundle.entryId.endsWith("server.jsx")
    );
  });
}

function bundleHasEntrypoint(bundle, suffix) {
  return (bundle.entrypoints ?? []).some((entrypoint) =>
    entrypoint.entryId.endsWith(suffix),
  );
}

function bundleAppliesTo(bundle, targetId) {
  return (bundle.targetIds ?? [bundle.targetId]).includes(targetId);
}

function conditionFileName(fileName, id) {
  return fileName.replace(/\.js$/, `.id-${id}.js`);
}

async function fetchText(url, options) {
  const response = await fetchWithTimeout(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return text;
}

async function fetchAsset(url, options) {
  const response = await fetchWithTimeout(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return {
    contentType: response.headers.get("content-type") ?? "",
    text,
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttp(url, readDiagnostics) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 60_000) {
    try {
      await fetchText(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}\n${readDiagnostics()}`,
  );
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!address || typeof address !== "object") {
    throw new Error("Could not allocate a free port.");
  }
  return address.port;
}
