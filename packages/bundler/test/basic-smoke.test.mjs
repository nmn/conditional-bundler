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
      env: { ...process.env, BUNDLER_MODE: "production" },
      timeout: 60_000,
    },
  );

  const manifest = await readManifest();
  const clientManifest = JSON.parse(
    await fs.readFile(
      path.join(exampleDir, "dist/rsc-client-manifest.json"),
      "utf8",
    ),
  );
  const clientBundle = findBundle(manifest, "client");
  const serverBundle = findBundle(manifest, "rsc");
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
    expect(html).toContain('<div id="root"><main class="shell">');
    expect(html).toContain("__BUNDLER_RSC_CHUNKS__");
    expect(html).toContain("__BUNDLER_RSC_DATA__");
    expect(html).not.toContain("importmap");
    expect(html).not.toContain("esm.sh");
    expect(html).toContain(
      `<script type="module" src="/assets/${clientBundle.fileName}"></script>`,
    );

    const clientAsset = await fetchAsset(
      `${baseUrl}/assets/${clientBundle.fileName}`,
    );
    expect(clientAsset.contentType).toContain("text/javascript");
    expect(clientAsset.text).toContain(
      `//# sourceMappingURL=${clientBundle.mapFileName}`,
    );
    const mapAsset = await fetchAsset(
      `${baseUrl}/assets/${clientBundle.mapFileName}`,
    );
    expect(mapAsset.contentType).toContain("application/json");
    expect(JSON.parse(mapAsset.text)).toMatchObject({
      version: 3,
      file: clientBundle.fileName,
    });

    const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
    expect(flight).toContain("src/Counter.jsx");
    expect(flight).not.toContain(":E");

    const counterAsset = await fetchAsset(
      `${baseUrl}/assets/${counterBundle.fileName}`,
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
        `${baseUrl}/assets/${counterBundle.fileName}`,
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
    { BUNDLER_MODE: "development" },
    async (baseUrl) => {
      const html = await fetchText(`${baseUrl}/`);
      expect(html).toContain(
        "Server components with a conditional client branch.",
      );
      expect(html).toContain("__BUNDLER_RSC_DATA__");
      const scriptMatch = html.match(
        /<script type="module" src="\/assets\/(client\.client\.[a-z0-9]+\.js)"><\/script>/,
      );
      expect(scriptMatch).not.toBeNull();

      const clientFileName = scriptMatch[1];
      const clientAsset = await fetchAsset(
        `${baseUrl}/assets/${clientFileName}`,
      );
      expect(clientAsset.contentType).toContain("text/javascript");
      expect(clientAsset.text).toContain("__BUNDLER_HMR__");
      expect(clientAsset.text).toContain(
        `//# sourceMappingURL=${clientFileName}.map`,
      );

      const mapAsset = await fetchAsset(
        `${baseUrl}/assets/${clientFileName}.map`,
      );
      expect(mapAsset.contentType).toContain("application/json");
      expect(JSON.parse(mapAsset.text)).toMatchObject({
        version: 3,
        file: clientFileName,
        sections: expect.any(Array),
      });

      const flight = await fetchText(`${baseUrl}/rsc?path=%2F`);
      expect(flight).toContain("src/Counter.jsx");
      expect(flight).not.toContain(":E");

      const manifest = await readManifest();
      const serverBundle = findBundle(manifest, "rsc");
      const counterBundle = manifest.bundles.find((bundle) =>
        bundle.conditionNames?.includes("DEV"),
      );
      const rawCounterCode = await fs.readFile(
        path.join(exampleDir, "dist", counterBundle.fileName),
        "utf8",
      );
      const counterAsset = await fetchAsset(
        `${baseUrl}/assets/${counterBundle.fileName}`,
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
      env: { ...process.env, DEV: "0", ...extraEnv, PORT: String(port) },
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
      env: { ...process.env, DEV: "0" },
      timeout: 10_000,
    },
  );

  expect(stdout).toMatch(/examples\/react-rsc-basic\/src\/server\.jsx:\d+:\d+/);
  expect(stdout).not.toContain(`/dist/${fileName}`);
}

async function readManifest() {
  return JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
}

function findBundle(manifest, envId) {
  return manifest.bundles.find(
    (bundle) =>
      bundle.envId === envId &&
      bundle.entryId.endsWith("client.jsx") === (envId === "client"),
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
  while (Date.now() - started < 15_000) {
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
