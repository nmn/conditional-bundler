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
  await execFileAsync(process.execPath, ["scripts/clean.mjs"], {
    cwd: exampleDir,
    timeout: 10_000,
  });
  await execFileAsync(
    process.execPath,
    [
      "../../packages/bundler/bin/bundler.js",
      "build",
      "--config",
      "bundler.config.mjs",
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        BUNDLER_MODE: "production",
      },
      timeout: 60_000,
    },
  );
  const clientManifest = JSON.parse(
    await fs.readFile(
      path.join(exampleDir, "dist/rsc-client-manifest.json"),
      "utf8",
    ),
  );
  const buildManifest = JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
  expectCjsNodeEnv(buildManifest, "production");
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
  const clientBundles = buildManifest.bundles.filter(
    (bundle) => bundle.envId === "client",
  );
  const clientBundleFiles = clientBundles
    .map((bundle) => bundle.fileName)
    .sort();
  const commonBundle = clientBundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:common:"),
  );
  expect(clientBundleFiles).toHaveLength(9);
  expect(clientBundleFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^CartContext\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^CartTable\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^CategoryPicker\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^CommerceChrome\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^DeliveryEstimator\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^HomeCounter\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^ProductActions\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^bundler-common-client\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^client\.client\.[a-z0-9]+\.js$/),
    ]),
  );
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
  const islandCodes = await Promise.all(
    Object.values(clientManifest).map((reference) =>
      fs.readFile(path.join(exampleDir, "dist", reference.fileName), "utf8"),
    ),
  );
  for (const code of islandCodes) {
    expect(code).toContain(`from "./${commonBundle.fileName}"`);
    expect(code).not.toContain("ReactSharedInternals");
  }
  const cartContextBundle = clientBundles.find((bundle) =>
    bundle.entryId.endsWith("src/client/CartContext.jsx"),
  );
  for (const component of ["CommerceChrome", "CartTable", "ProductActions"]) {
    const reference =
      clientManifest[`src/client/${component}.jsx#${component}`];
    const code = await fs.readFile(
      path.join(exampleDir, "dist", reference.fileName),
      "utf8",
    );
    expect(code).toContain(`from "./${cartContextBundle.fileName}"`);
  }
  expect(
    buildManifest.bundles.every(
      (bundle) => bundle.mapFileName === `${bundle.fileName}.map`,
    ),
  ).toBe(true);
  for (const bundle of buildManifest.bundles) {
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
  const serverBundle = buildManifest.bundles.find(
    (bundle) => bundle.envId === "rsc" && bundle.entryId.endsWith("server.jsx"),
  );
  await expectMappedServerStack(serverBundle.fileName);
  const productActionRef =
    clientManifest["src/client/ProductActions.jsx#ProductActions"];
  expect(productActionRef.name).toMatch(/_ProductActions$/);
  expect(productActionRef.id).toMatch(/src\/client\/ProductActions\.jsx$/);
  expect(productActionRef.fileName).toMatch(
    /^ProductActions\.client\.[a-z0-9]+\.js$/,
  );
  expect(productActionRef.chunks).toEqual([
    productActionRef.id,
    productActionRef.fileName,
  ]);
  const homeCounterRef =
    clientManifest["src/client/HomeCounter.jsx#HomeCounter"];
  expect(homeCounterRef.name).toMatch(/_HomeCounter$/);
  expect(homeCounterRef.id).toMatch(/src\/client\/HomeCounter\.jsx$/);
  expect(homeCounterRef.fileName).toMatch(
    /^HomeCounter\.client\.[a-z0-9]+\.js$/,
  );
  expect(homeCounterRef.chunks).toEqual([
    homeCounterRef.id,
    homeCounterRef.fileName,
  ]);
  const categoryPickerRef =
    clientManifest["src/client/CategoryPicker.jsx#CategoryPicker"];
  expect(categoryPickerRef).toMatchObject({
    id: expect.stringMatching(/src\/client\/CategoryPicker\.jsx$/),
    fileName: expect.stringMatching(/^CategoryPicker\.client\.[a-z0-9]+\.js$/),
  });
  const deliveryEstimatorRef =
    clientManifest["src/client/DeliveryEstimator.jsx#DeliveryEstimator"];
  expect(deliveryEstimatorRef).toMatchObject({
    id: expect.stringMatching(/src\/client\/DeliveryEstimator\.jsx$/),
    fileName: expect.stringMatching(
      /^DeliveryEstimator\.client\.[a-z0-9]+\.js$/,
    ),
  });

  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      "@bundler/assets/register",
      "--require",
      "@bundler/react-rsc-plugin/register-source-maps",
      "--conditions",
      "react-server",
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
    expect(html).toContain('<main class="app-shell" data-route="home">');
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).not.toContain("Preparing aisle");
    expect(html).toContain("__BUNDLER_RSC_CHUNKS__");
    expect(html).toContain("__BUNDLER_RSC_DATA__");
    expect(html).not.toContain("importmap");
    expect(html).not.toContain("esm.sh");
    expect(html).toMatch(
      /<script type="module" src="\/assets\/client\.client\.[a-z0-9]+\.js"><\/script>/,
    );
    const clientBundle = buildManifest.bundles.find(
      (bundle) =>
        bundle.envId === "client" && bundle.entryId.endsWith("client.jsx"),
    );
    const clientAsset = await fetchAsset(
      `${baseUrl}/assets/${clientBundle.fileName}`,
    );
    expect(clientAsset.contentType).toContain("text/javascript");
    expect(clientAsset.text).toContain(
      `//# sourceMappingURL=${clientBundle.mapFileName}`,
    );
    const clientMapAsset = await fetchAsset(
      `${baseUrl}/assets/${clientBundle.mapFileName}`,
    );
    expect(clientMapAsset.contentType).toContain("application/json");
    expect(JSON.parse(clientMapAsset.text)).toMatchObject({
      version: 3,
      file: clientBundle.fileName,
    });

    const home = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(home).toContain("src/client/HomeCounter.jsx");
    expect(home).toContain("src/client/CategoryPicker.jsx");
    expect(home).toContain("src/client/DeliveryEstimator.jsx");
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
    expect(product).toContain("DEV merchandising");
    expect(product).not.toContain("available for this batch");
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
      "--conditions",
      "react-server",
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
    const scriptMatch = html.match(
      /<script type="module" src="\/assets\/(client\.client\.[a-z0-9]+\.js)"><\/script>/,
    );
    expect(scriptMatch).not.toBeNull();

    const bundleFileName = scriptMatch[1];
    const bundleAsset = await fetchAsset(`${baseUrl}/assets/${bundleFileName}`);
    expect(bundleAsset.contentType).toContain("text/javascript");
    expect(bundleAsset.text).toContain(
      `//# sourceMappingURL=${bundleFileName}.map`,
    );

    const mapAsset = await fetchAsset(
      `${baseUrl}/assets/${bundleFileName}.map`,
    );
    expect(mapAsset.contentType).toContain("application/json");
    expect(JSON.parse(mapAsset.text)).toMatchObject({
      version: 3,
      file: bundleFileName,
      sections: expect.any(Array),
    });

    const product = await fetchText(
      `${baseUrl}/rsc?path=${encodeURIComponent("/product/copper-kettle")}`,
    );
    expect(product).toContain("available for this batch");
    expect(product).not.toContain("DEV merchandising");

    const home = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(home).toContain("src/client/HomeCounter.jsx");
    expect(home).toContain("src/client/CategoryPicker.jsx");
    expect(home).toContain("src/client/DeliveryEstimator.jsx");
    expect(home).not.toContain(":E");

    const manifest = JSON.parse(
      await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
    );
    expectCjsNodeEnv(manifest, "development");
    const clientBundles = manifest.bundles.filter(
      (bundle) => bundle.envId === "client",
    );
    const runtimeBundle = clientBundles.find(
      (bundle) => bundle.entryId === "bundler:hmr-runtime:client",
    );
    const commonBundle = clientBundles.find(
      (bundle) => bundle.entryId === "bundler:common:client",
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
      expect(code).toContain(`from "./${runtimeBundle.fileName}"`);
    }
    const serverBundle = manifest.bundles.find(
      (bundle) =>
        bundle.envId === "rsc" && bundle.entryId.endsWith("server.jsx"),
    );
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

function expectCjsNodeEnv(manifest, expected) {
  const prefix = "virtual:cjs-to-esm:";
  const records = Array.from(
    new Set(
      manifest.bundles
        .flatMap((bundle) => bundle.modules)
        .filter((id) => id.startsWith(prefix)),
    ),
    (id) => {
      const [envId, nodeEnv, encodedPath] = id.slice(prefix.length).split(":");
      return {
        envId: decodeURIComponent(envId),
        nodeEnv: decodeURIComponent(nodeEnv),
        filePath: Buffer.from(encodedPath, "base64url").toString("utf8"),
      };
    },
  );
  const opposite = expected === "production" ? "development" : "production";

  expect(records.length).toBeGreaterThan(0);
  expect(new Set(records.map((record) => record.nodeEnv))).toEqual(
    new Set([expected]),
  );
  expect(
    records.some((record) => record.filePath.includes(`.${expected}.js`)),
  ).toBe(true);
  expect(
    records.some((record) => record.filePath.includes(`.${opposite}.js`)),
  ).toBe(false);
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
      "--conditions",
      "react-server",
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
      "--conditions",
      "react-server",
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
    /examples\/react-rsc-commerce\/src\/server\.jsx:\d+:\d+/,
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
    const records = Object.values(parsed.fileRecordsByEnv ?? {});
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
