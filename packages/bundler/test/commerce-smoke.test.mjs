import { spawn, execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const exampleDir = path.join(rootDir, "examples/react-rsc-commerce");

jest.setTimeout(120_000);

test("react-rsc-commerce production server serves HTML and RSC routes", async () => {
  await execFileAsync("corepack", ["pnpm", "run", "build"], {
    cwd: exampleDir,
    env: process.env,
    timeout: 60_000,
  });
  const buildManifest = JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
  const clientReferences = buildManifest.metadata.rsc.clientReferenceBundles;
  expect(buildManifest.metadata.rsc.inline).toBe(true);
  await expect(
    fs.access(path.join(exampleDir, "dist/rsc-client-manifest.json")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  expectCjsNodeEnv(buildManifest, "production");
  const showcaseAssets = await expectShowcaseAssets(buildManifest);
  expect(
    buildManifest.bundles.filter(
      (bundle) =>
        bundleAppliesTo(bundle, "rsc") &&
        bundle.entryId.startsWith("bundler:shared:"),
    ).length,
  ).toBe(4);
  for (const envId of ["rsc", "client"]) {
    const modules = buildManifest.bundles
      .filter((bundle) => bundleAppliesTo(bundle, envId))
      .flatMap((bundle) => bundle.modules);
    expect(new Set(modules).size).toBe(modules.length);
  }
  const cachedModuleIdentities = await findCachedModuleIdentities(
    path.join(exampleDir, ".cache/conditional-bundler"),
  );
  expect(cachedModuleIdentities).toEqual(
    expect.arrayContaining([expect.stringMatching(/^react@19\.2\.5::/)]),
  );
  expect(cachedModuleIdentities.every((item) => !path.isAbsolute(item))).toBe(
    true,
  );
  expect(cachedModuleIdentities.some((item) => item.includes(rootDir))).toBe(
    false,
  );
  const clientBundles = buildManifest.bundles.filter((bundle) =>
    bundleAppliesTo(bundle, "client"),
  );
  const clientBundleFiles = clientBundles
    .map((bundle) => bundle.fileName)
    .sort();
  const commonBundle = clientBundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:shared:"),
  );
  expect(clientBundleFiles).toHaveLength(5);
  expect(clientBundleFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /^CartTable\.client\.react\.client\.[a-z0-9]+\.js$/,
      ),
      expect.stringMatching(
        /^ProductActions\.client\.react\.client\.[a-z0-9]+\.js$/,
      ),
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
      fileName.startsWith("bundler-dynamic-group-"),
    ),
  ).toHaveLength(2);
  expect(
    clientBundleFiles.filter((fileName) =>
      fileName.startsWith("bundler-shared-"),
    ),
  ).toHaveLength(1);
  expect(clientBundleFiles).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^client-references\.client\.[a-z0-9]+\.js$/),
    ]),
  );
  expect(commonBundle).toBeDefined();
  const clientModuleIds = clientBundles.flatMap((bundle) => bundle.modules);
  expect(new Set(clientModuleIds).size).toBe(clientModuleIds.length);
  const commonCode = await fs.readFile(
    path.join(exampleDir, "dist", commonBundle.fileName),
    "utf8",
  );
  expect(commonCode).toContain("ReactSharedInternals");
  const islandOutputs = await Promise.all(
    Object.values(clientReferences).map(async (reference) => {
      const bundle = buildManifest.bundles.find(
        (candidate) => candidate.id === reference.client,
      );
      return {
        bundle,
        code: await fs.readFile(
          path.join(exampleDir, "dist", bundle.fileName),
          "utf8",
        ),
      };
    }),
  );
  for (const { bundle, code } of islandOutputs) {
    expect(code).toContain(
      `from "./${conditionFileName(commonBundle.fileName, "x")}"`,
    );
    if (!bundleHasEntrypoint(bundle, "src/client.jsx")) {
      expect(code).not.toContain("ReactSharedInternals");
    }
  }
  const cartContextBundle = clientBundles.find((bundle) =>
    bundleHasEntrypoint(bundle, "src/client/CartContext.jsx"),
  );
  const commerceChromeBundle = buildManifest.bundles.find(
    (bundle) =>
      bundle.id === clientReferences["/src/client/CommerceChrome.jsx"].client,
  );
  expect(commerceChromeBundle.id).toBe(cartContextBundle.id);
  for (const component of ["CartTable", "ProductActions"]) {
    const reference = clientReferences[`/src/client/${component}.jsx`];
    const referenceBundle = buildManifest.bundles.find(
      (bundle) => bundle.id === reference.client,
    );
    const code = await fs.readFile(
      path.join(exampleDir, "dist", referenceBundle.fileName),
      "utf8",
    );
    expect(code).toContain(
      `from "./${conditionFileName(cartContextBundle.fileName, "x")}"`,
    );
  }
  expect(
    buildManifest.bundles.every(
      (bundle) => bundle.mapFileName === `${bundle.fileName}.map`,
    ),
  ).toBe(true);
  for (const bundle of buildManifest.bundles) {
    const code = await fs.readFile(
      path.join(exampleDir, "dist", bundle.fileName),
      "utf8",
    );
    expect(code).toContain(`//# sourceMappingURL=${bundle.mapFileName}`);
    const sourceMap = JSON.parse(
      await fs.readFile(
        path.join(exampleDir, "dist", bundle.mapFileName),
        "utf8",
      ),
    );
    expect(sourceMap).toMatchObject({
      version: 3,
      file: bundle.fileName,
      sections: expect.any(Array),
    });
  }
  const serverBundle = findRscBundle(buildManifest);
  await expectMappedServerStack(serverBundle.fileName);
  const productActionRef = clientReferences["/src/client/ProductActions.jsx"];
  const productActionBundle = buildManifest.bundles.find(
    (bundle) => bundle.id === productActionRef.client,
  );
  expect(productActionRef).toEqual({
    client: expect.any(String),
    server: expect.any(String),
  });
  expect(productActionBundle.fileName).toMatch(
    /^ProductActions\.client\.react\.client\.[a-z0-9]+\.js$/,
  );
  const homeCounterRef = clientReferences["/src/client/HomeCounter.jsx"];
  const homeCounterBundle = buildManifest.bundles.find(
    (bundle) => bundle.id === homeCounterRef.client,
  );
  const homeCounterCode = await fs.readFile(
    path.join(exampleDir, "dist", homeCounterBundle.fileName),
    "utf8",
  );
  const homeCounterExportName = homeCounterCode.match(
    /export \{ ([a-z0-9]+_HomeCounter)(?:, [^}]*)? \};/,
  )?.[1];
  expect(homeCounterBundle.fileName).toMatch(
    /^bundler-dynamic-group-[a-z0-9]+\.client\.react\.client\.[a-z0-9]+\.js$/,
  );
  expect(homeCounterExportName).toBeDefined();
  expect(homeCounterCode).not.toMatch(/\bas HomeCounter\b/);
  expect(Object.keys(clientReferences).sort()).toEqual([
    "/src/BrowserString.jsx",
    "/src/client/CartContext.jsx",
    "/src/client/CartTable.jsx",
    "/src/client/CategoryPicker.jsx",
    "/src/client/CommerceChrome.jsx",
    "/src/client/DeliveryEstimator.jsx",
    "/src/client/HomeCounter.jsx",
    "/src/client/ProductActions.jsx",
    "/src/client/Router.jsx",
  ]);
  const homeRouteClientIds = [
    "CategoryPicker",
    "DeliveryEstimator",
    "HomeCounter",
  ].map((component) => clientReferences[`/src/client/${component}.jsx`].client);
  expect(new Set(homeRouteClientIds)).toEqual(new Set([homeCounterRef.client]));
  const homeRouteServerIds = [
    "CategoryPicker",
    "DeliveryEstimator",
    "HomeCounter",
  ].map((component) => clientReferences[`/src/client/${component}.jsx`].server);
  expect(new Set(homeRouteServerIds).size).toBe(1);
  const homeCounterServerBundle = buildManifest.bundles.find(
    (bundle) => bundle.id === homeCounterRef.server,
  );
  expect(homeCounterServerBundle.entryId).toBe(homeCounterBundle.entryId);
  const appShellClientIds = [
    "/src/BrowserString.jsx",
    "/src/client/CartContext.jsx",
    "/src/client/CommerceChrome.jsx",
    "/src/client/Router.jsx",
  ].map((id) => clientReferences[id].client);
  expect(new Set(appShellClientIds).size).toBe(1);
  expect(homeCounterBundle.entrypoints).toHaveLength(3);
  expect(JSON.stringify(clientReferences)).not.toContain(rootDir);

  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      "@bundler/react-rsc-plugin/register-source-maps",
      "scripts/start.mjs",
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        DEV: "0",
        NODE_ENV: "production",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let childOutput = "";
  child.stdout.on("data", (chunk) => {
    childOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    childOutput += chunk;
  });
  let childExited = false;
  const childExit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      childExited = true;
      resolve({ code, signal });
    });
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(`${baseUrl}/`, () => childOutput);
    const html = await fetchText(`${baseUrl}/`);
    expect(html).toContain("Monarch Goods");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      '<meta name="description" content="An editorial React Server Components storefront built with conditional-bundler."/>',
    );
    expect(html).not.toContain("<style>");
    expect(html).toContain('data-router="client"');
    expect(html).toMatch(
      /<main class="app-shell [a-z][a-z0-9]{7}" data-route="home">/,
    );
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).not.toContain("Preparing aisle");
    expect(html).not.toContain("__BUNDLER_RSC_CHUNKS__");
    expect(html).toContain("__BUNDLER_RSC_DATA__");
    expect(html).not.toContain("importmap");
    expect(html).not.toContain("esm.sh");
    const clientBundle = buildManifest.bundles.find((bundle) =>
      bundleHasEntrypoint(bundle, "src/client.jsx"),
    );
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
    expect(clientAsset.text).toContain(
      `//# sourceMappingURL=${clientBundle.mapFileName}`,
    );
    const clientMapAsset = await fetchAsset(
      `${baseUrl}/${clientBundle.mapFileName}`,
    );
    expect(clientMapAsset.contentType).toContain("application/json");
    expect(JSON.parse(clientMapAsset.text)).toMatchObject({
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

    const home = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(home).toContain("src/client/HomeCounter.jsx");
    expect(home).toContain("src/client/CategoryPicker.jsx");
    expect(home).toContain("src/client/DeliveryEstimator.jsx");
    expect(home).toContain(
      `["/src/client/HomeCounter.jsx",["/${conditionFileName(
        homeCounterBundle.fileName,
        "0",
      )}","/${conditionFileName(commonBundle.fileName, "0")}"],"${homeCounterExportName}"]`,
    );
    expect(home).not.toContain(":E");

    const catalog = await fetchText(
      `${baseUrl}/rsc?path=${encodeURIComponent("/catalog?category=Coffee")}`,
    );
    expect(catalog).toContain('"path":"/catalog?category=Coffee"');
    expect(catalog).toContain("src/client/ProductActions.jsx");
    expect(catalog).not.toContain("client-references.client");
    expect(catalog).not.toContain(":E");

    const product = await fetchText(
      `${baseUrl}/rsc?path=${encodeURIComponent("/product/copper-kettle")}`,
    );
    expect(product).toContain('"path":"/product/copper-kettle"');
    expect(product).toContain("src/client/ProductActions.jsx");
    expect(product).toContain("available for this batch");
    expect(product).not.toContain("DEV merchandising");
    expect(product).not.toContain("client-references.client");
    expect(product).not.toContain(":E");
  } finally {
    if (!childExited) {
      child.kill();
    }
    await childExit;
  }

  await withCommerceServer({ DEV: "1" }, async (baseUrl) => {
    const product = await fetchText(
      `${baseUrl}/rsc?path=${encodeURIComponent("/product/copper-kettle")}`,
    );
    expect(product).toContain("available for this batch");
    expect(product).not.toContain("DEV merchandising");
    expect(product).not.toContain(":E");
  });
});

test("react-rsc-commerce dev server serves linked source maps", async () => {
  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      "@bundler/react-rsc-plugin/register-source-maps",
      "scripts/dev.mjs",
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        DEV: "0",
        NODE_ENV: "development",
        BUNDLER_MODE: "development",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let childOutput = "";
  child.stdout.on("data", (chunk) => {
    childOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    childOutput += chunk;
  });
  let childExited = false;
  const childExit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      childExited = true;
      resolve({ code, signal });
    });
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(`${baseUrl}/`, () => childOutput);
    const html = await fetchText(`${baseUrl}/`);
    expect(html).toContain("HomeCounter.client.react.client.");
    expect(html).toContain("CategoryPicker.client.react.client.");
    expect(html).toContain("DeliveryEstimator.client.react.client.");
    expect(html).toContain("Router.client.react.client.");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).not.toContain("<style>");
    const styleMatch = html.match(
      /<link rel="stylesheet" href="\/(server\.server\.react\.server\.[a-z0-9]+\.css)"/,
    );
    expect(styleMatch).not.toBeNull();
    const scriptMatch = html.match(
      /<script type="module" src="\/(client\.client\.react\.client\.[a-z0-9]+\.id-0\.js)"><\/script>/,
    );
    expect(scriptMatch).not.toBeNull();

    const bundleFileName = scriptMatch[1];
    const rawBundleFileName = bundleFileName.replace(".id-0.js", ".js");
    const bundleAsset = await fetchAsset(`${baseUrl}/${bundleFileName}`);
    expect(bundleAsset.contentType).toContain("text/javascript");
    expect(bundleAsset.text).toContain(
      `//# sourceMappingURL=${rawBundleFileName}.map`,
    );

    const mapAsset = await fetchAsset(`${baseUrl}/${rawBundleFileName}.map`);
    expect(mapAsset.contentType).toContain("application/json");
    expect(JSON.parse(mapAsset.text)).toMatchObject({
      version: 3,
      file: rawBundleFileName,
      sections: expect.any(Array),
    });

    const product = await fetchText(
      `${baseUrl}/rsc?path=${encodeURIComponent("/product/copper-kettle")}`,
    );
    expect(product).toContain("DEV merchandising");
    expect(product).not.toContain("available for this batch");

    const home = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(home).toContain("src/client/HomeCounter.jsx");
    expect(home).toContain("src/client/CategoryPicker.jsx");
    expect(home).toContain("src/client/DeliveryEstimator.jsx");
    expect(home).not.toContain(":E");

    const manifest = JSON.parse(
      await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
    );
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
    const serverBundle = findRscBundle(manifest);
    expect(serverBundle.mapFileName).toBe(`${serverBundle.fileName}.map`);
    await expect(
      fs.stat(path.join(exampleDir, "dist", serverBundle.mapFileName)),
    ).resolves.toBeDefined();
    await expectMappedServerStack(serverBundle.fileName, "?stack-probe=1");
  } finally {
    if (!childExited) {
      child.kill("SIGINT");
    }
    await childExit;
  }
});

async function expectShowcaseAssets(manifest) {
  const mark = manifest.assets.find(
    (asset) =>
      asset.type === "asset" && asset.fileName.includes("monarch-mark"),
  );
  const texture = manifest.assets.find(
    (asset) =>
      asset.type === "asset" && asset.fileName.includes("monarch-texture"),
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
  expect(css).toContain("@supports (display: grid)");
  expect(css).toContain("outline-offset: 6px");
  expect(css.indexOf("isolation: isolate")).toBeLessThan(
    css.indexOf("position: relative"),
  );
  const assetBackgroundIndex = css.search(
    /background: var\(--[^)]*__finalURL\)/,
  );
  expect(assetBackgroundIndex).toBeGreaterThan(-1);
  expect(css.indexOf("position: relative")).toBeLessThan(assetBackgroundIndex);

  const serverBundle = findRscBundle(manifest);
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

async function withCommerceServer(extraEnv, run) {
  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      "@bundler/react-rsc-plugin/register-source-maps",
      "scripts/start.mjs",
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        DEV: "0",
        NODE_ENV: "production",
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
      child.kill("SIGTERM");
    }
    await exit;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAsset(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}: ${text}`);
    }
    return {
      contentType: response.headers.get("content-type") ?? "",
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function conditionFileName(fileName, id) {
  return fileName.replace(/\.js$/, `.id-${id}.js`);
}

async function expectMappedServerStack(fileName, query = "") {
  const specifier = `./dist/${fileName}${query}`;
  const script = `
    globalThis.__BUNDLER_RSC_DEV__ = true;
    import(${JSON.stringify(specifier)}).then(async (module) => {
      try {
        await module.handleCommerceRequest({
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
      "@bundler/react-rsc-plugin/register-source-maps",
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
    /bundler:\/react-rsc-commerce%400\.1\.0%3A%3Asrc\/server\.jsx:\d+:\d+/,
  );
  expect(stdout).not.toContain(`/dist/${fileName}`);
}

async function waitForHttp(url, readDiagnostics = () => "") {
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
  const diagnostics = readDiagnostics();
  const suffix = diagnostics ? `\nServer output:\n${diagnostics}` : "";
  if (lastError) {
    throw new Error(
      `Timed out waiting for ${url}: ${lastError.message}${suffix}`,
    );
  }
  throw new Error(`Timed out waiting for ${url}${suffix}`);
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

async function findCachedModuleIdentities(cacheDir) {
  const moduleFiles = await findFilesNamed(cacheDir, "module.json");
  const found = new Set();
  for (const filePath of moduleFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const records = Object.values(parsed.scopeVariants ?? {}).map(
      (variant) => variant.fileRecord,
    );
    for (const record of records) {
      if (record?.filePath) {
        found.add(record.filePath);
      }
    }
  }
  return Array.from(found).sort();
}

async function findFilesNamed(root, fileName) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFilesNamed(entryPath, fileName)));
    } else if (entry.name === fileName) {
      files.push(entryPath);
    }
  }
  return files;
}

function bundleAppliesTo(bundle, kind) {
  if (kind === "rsc") {
    return (
      (bundle.targetIds ?? [bundle.targetId]).includes("server") &&
      (bundle.environmentIds ?? []).includes("react.server")
    );
  }
  return (bundle.targetIds ?? [bundle.targetId]).includes(kind);
}

function bundleHasEntrypoint(bundle, suffix) {
  return (bundle.entrypoints ?? []).some((entrypoint) =>
    entrypoint.entryId.endsWith(suffix),
  );
}

function findRscBundle(manifest) {
  return manifest.bundles.find(
    (bundle) =>
      bundleAppliesTo(bundle, "rsc") && bundle.entryId.endsWith("server.jsx"),
  );
}
