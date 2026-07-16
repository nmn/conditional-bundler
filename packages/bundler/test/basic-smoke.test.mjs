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

jest.setTimeout(120_000);

test("react-rsc-basic production serves hydrated RSC output and source maps", async () => {
  await fs.rm(path.join(exampleDir, ".cache/conditional-bundler"), {
    recursive: true,
    force: true,
  });
  await execFileAsync("corepack", ["pnpm", "run", "build"], {
    cwd: exampleDir,
    env: process.env,
    timeout: 60_000,
  });

  const manifest = await readManifest();
  expectCjsNodeEnv(manifest, "production");
  const showcaseAssets = await expectShowcaseAssets(manifest);
  const clientManifest = JSON.parse(
    await fs.readFile(
      path.join(exampleDir, "dist/rsc-client-manifest.json"),
      "utf8",
    ),
  );
  const clientBundle = findBundle(manifest, "client");
  const serverBundle = findBundle(manifest, "rsc");
  const clientBundles = manifest.bundles.filter(
    (bundle) => bundle.envId === "client",
  );
  const clientBundleFiles = clientBundles
    .map((bundle) => bundle.fileName)
    .sort();
  const commonBundle = clientBundles.find((bundle) =>
    bundle.entryId.startsWith("bundler:common:"),
  );
  const counterBundle = manifest.bundles.find(
    (bundle) =>
      bundle.fileName === clientManifest["src/Counter.jsx#Counter"].fileName,
  );
  const rawCounterCode = await fs.readFile(
    path.join(exampleDir, "dist", counterBundle.fileName),
    "utf8",
  );

  expect(clientManifest["src/Counter.jsx#Counter"]).toMatchObject({
    id: expect.stringMatching(/src\/Counter\.jsx$/),
    fileName: expect.stringMatching(/^Counter\.client\.[a-z0-9]+\.js$/),
    chunks: expect.any(Array),
  });
  expect(clientBundleFiles).toHaveLength(5);
  expect(clientBundleFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^Counter\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^DraftPad\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^PreferenceSwitch\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^bundler-common-client\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^runtime-client\.client\.[a-z0-9]+\.js$/),
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
  for (const reference of [
    clientManifest["src/Counter.jsx#Counter"],
    clientManifest["src/DraftPad.jsx#DraftPad"],
    clientManifest["src/PreferenceSwitch.jsx#PreferenceSwitch"],
  ]) {
    const code = await fs.readFile(
      path.join(exampleDir, "dist", reference.fileName),
      "utf8",
    );
    expect(code).toContain(`from "./${commonBundle.fileName}"`);
    expect(code).not.toContain("ReactSharedInternals");
  }
  expect(clientManifest["src/DraftPad.jsx#DraftPad"]).toMatchObject({
    id: expect.stringMatching(/src\/DraftPad\.jsx$/),
    fileName: expect.stringMatching(/^DraftPad\.client\.[a-z0-9]+\.js$/),
  });
  expect(
    clientManifest["src/PreferenceSwitch.jsx#PreferenceSwitch"],
  ).toMatchObject({
    id: expect.stringMatching(/src\/PreferenceSwitch\.jsx$/),
    fileName: expect.stringMatching(
      /^PreferenceSwitch\.client\.[a-z0-9]+\.js$/,
    ),
  });
  expect(counterBundle.conditionNames).toEqual(["DEV"]);
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
    expect(html).toContain('<main class="shell">');
    expect(html).toContain("__BUNDLER_RSC_CHUNKS__");
    expect(html).toContain("__BUNDLER_RSC_DATA__");
    expect(html).not.toContain("importmap");
    expect(html).not.toContain("esm.sh");
    expect(html).toContain(
      `<script type="module" src="/${clientBundle.fileName}"></script>`,
    );

    const clientAsset = await fetchAsset(`${baseUrl}/${clientBundle.fileName}`);
    expect(clientAsset.contentType).toContain("text/javascript");
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

    const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(flight).toContain("src/Counter.jsx");
    expect(flight).toContain("src/DraftPad.jsx");
    expect(flight).toContain("src/PreferenceSwitch.jsx");
    expect(flight).not.toContain(":E");

    const counterAsset = await fetchAsset(
      `${baseUrl}/${counterBundle.fileName}`,
    );
    expect(counterAsset.text).toHaveLength(rawCounterCode.length);
    expect(counterAsset.text).not.toContain("CONDITION_START");
    expect(counterAsset.text).not.toContain("console.log(message);");
  });

  await withExampleServer(
    "scripts/start.mjs",
    { DEV: "1" },
    async (baseUrl) => {
      const counterAsset = await fetchAsset(
        `${baseUrl}/${counterBundle.fileName}`,
      );
      expect(counterAsset.text).toHaveLength(rawCounterCode.length);
      expect(counterAsset.text).not.toContain("CONDITION_START");
      expect(counterAsset.text).toContain("console.log(message);");
    },
  );
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
      expect(html).toContain("__BUNDLER_RSC_DATA__");
      expect(html).toContain("Counter.client.");
      expect(html).toContain("DraftPad.client.");
      expect(html).toContain("PreferenceSwitch.client.");
      const scriptMatch = html.match(
        /<script type="module" src="\/(runtime-client\.client\.[a-z0-9]+\.js)"><\/script>/,
      );
      expect(scriptMatch).not.toBeNull();

      const clientFileName = scriptMatch[1];
      const clientAsset = await fetchAsset(`${baseUrl}/${clientFileName}`);
      expect(clientAsset.contentType).toContain("text/javascript");
      expect(clientAsset.text).toContain("__BUNDLER_HMR__");
      expect(clientAsset.text).toContain(
        `//# sourceMappingURL=${clientFileName}.map`,
      );

      const mapAsset = await fetchAsset(`${baseUrl}/${clientFileName}.map`);
      expect(mapAsset.contentType).toContain("application/json");
      expect(JSON.parse(mapAsset.text)).toMatchObject({
        version: 3,
        file: clientFileName,
        sections: expect.any(Array),
      });

      const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
      expect(flight).toContain("src/Counter.jsx");
      expect(flight).toContain("src/DraftPad.jsx");
      expect(flight).toContain("src/PreferenceSwitch.jsx");
      expect(flight).not.toContain(":E");

      const manifest = await readManifest();
      expectCjsNodeEnv(manifest, "development");
      const showcaseAssets = await expectShowcaseAssets(manifest);
      const markAsset = await fetchAsset(
        `${baseUrl}/${showcaseAssets.mark.fileName}`,
      );
      expect(markAsset.contentType).toContain("image/svg+xml");
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
      const serverBundle = findBundle(manifest, "rsc");
      const counterBundle = manifest.bundles.find((bundle) =>
        bundle.conditionNames?.includes("DEV"),
      );
      const rawCounterCode = await fs.readFile(
        path.join(exampleDir, "dist", counterBundle.fileName),
        "utf8",
      );
      const counterAsset = await fetchAsset(
        `${baseUrl}/${counterBundle.fileName}`,
      );
      expect(counterAsset.text).toHaveLength(rawCounterCode.length);
      expect(counterAsset.text).not.toContain("CONDITION_START");
      expect(counterAsset.text).not.toContain("console.log(message);");
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
      "--conditions",
      "react-server",
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
  expect(css.indexOf("isolation: isolate")).toBeLessThan(
    css.indexOf("position: relative"),
  );
  expect(css.indexOf("position: relative")).toBeLessThan(
    css.indexOf("background: var(--"),
  );

  const serverBundle = findBundle(manifest, "rsc");
  const serverCode = await fs.readFile(
    path.join(exampleDir, "dist", serverBundle.fileName),
    "utf8",
  );
  expect(serverCode).toContain(`"/${mark.fileName}"`);
  expect(serverCode).toMatch(
    /src: __bundler_[a-z0-9]+_asset_url,\s+width: 64,\s+height: 64/,
  );
  return { mark, texture, style };
}

function expectCjsNodeEnv(manifest, expected) {
  const records = Array.from(
    new Set(manifest.bundles.flatMap((bundle) => bundle.modules)),
  ).filter(
    (id) =>
      id.includes("/cjs/") && /\.(?:production|development)\.js$/.test(id),
  );
  const opposite = expected === "production" ? "development" : "production";

  expect(records.length).toBeGreaterThan(0);
  expect(records.some((id) => id.includes(`.${expected}.js`))).toBe(true);
  expect(records.some((id) => id.includes(`.${opposite}.js`))).toBe(false);
}

function findBundle(manifest, envId) {
  return manifest.bundles.find(
    (bundle) =>
      bundle.envId === envId &&
      bundle.entryId.endsWith("runtime-client.js") === (envId === "client"),
  );
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return text;
}

async function fetchAsset(url) {
  const response = await fetchWithTimeout(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return {
    contentType: response.headers.get("content-type") ?? "",
    text,
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    return await fetch(url, { signal: controller.signal });
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
