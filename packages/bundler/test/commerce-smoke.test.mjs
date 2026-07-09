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
      env: { ...process.env, BUNDLER_MODE: "production" },
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
  const cachedNodeModulePaths = await findCachedNodeModulePaths(
    path.join(exampleDir, ".cache/conditional-bundler"),
  );
  expect(cachedNodeModulePaths).toEqual(
    expect.arrayContaining([
      expect.stringContaining(`${path.sep}node_modules${path.sep}`),
    ]),
  );
  expect(cachedNodeModulePaths.some((item) => item.includes("react"))).toBe(
    true,
  );
  const clientBundleFiles = buildManifest.bundles
    .filter((bundle) => bundle.envId === "client")
    .map((bundle) => bundle.fileName)
    .sort();
  expect(clientBundleFiles).toHaveLength(6);
  expect(clientBundleFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^CartContext\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^CartTable\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^CommerceChrome\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^HomeCounter\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^ProductActions\.client\.[a-z0-9]+\.js$/),
      expect.stringMatching(/^client\.client\.[a-z0-9]+\.js$/),
    ]),
  );
  expect(clientBundleFiles).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^client-references\.client\.[a-z0-9]+\.js$/),
    ]),
  );
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

  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    ["--conditions", "react-server", "scripts/start.mjs"],
    {
      cwd: exampleDir,
      env: { ...process.env, PORT: String(port) },
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
    expect(product).not.toContain("client-references.client");
    expect(product).not.toContain(":E");
  } finally {
    if (!childExited) {
      child.kill();
    }
    await childExit;
  }
});

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

async function waitForHttp(url, readDiagnostics = () => "") {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 10_000) {
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

async function findCachedNodeModulePaths(cacheDir) {
  const moduleFiles = await findFilesNamed(cacheDir, "module.json");
  const found = new Set();
  for (const filePath of moduleFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const records = Object.values(parsed.fileRecordsByEnv ?? {});
    for (const record of records) {
      if (record?.filePath?.includes(`${path.sep}node_modules${path.sep}`)) {
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
