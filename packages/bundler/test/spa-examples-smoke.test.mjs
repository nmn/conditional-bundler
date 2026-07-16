import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const examples = [
  {
    name: "react-spa-stylex",
    title: "Greenline Ops",
    route: "/inventory",
    heading: "Stock without guesswork.",
    stylePattern: /^stylex\.all\.[a-z0-9]+\.css$/,
  },
  {
    name: "react-spa-tailwind",
    title: "Signal House",
    route: "/reports",
    heading: "Signals, not spreadsheet fog.",
    stylePattern: /^tailwind\.all\.[a-z0-9]+\.css$/,
  },
];

jest.setTimeout(120_000);

for (const example of examples) {
  test(`${example.name} shares transforms and works in production and development`, async () => {
    const exampleDir = path.join(rootDir, "examples", example.name);
    const cacheDir = path.join(exampleDir, ".cache/conditional-bundler");
    await fs.rm(cacheDir, { recursive: true, force: true });

    await buildExample(exampleDir, "production");
    const manifest = await readManifest(exampleDir);
    expectBundleShape(manifest);
    const styles = manifest.assets.filter((asset) => asset.type === "style");
    expect(styles).toHaveLength(1);
    expect(styles[0].fileName).toMatch(example.stylePattern);
    await expect(
      fs.stat(path.join(exampleDir, "dist", `${styles[0].fileName}.map`)),
    ).resolves.toBeDefined();
    for (const bundle of manifest.bundles) {
      expect(bundle.mapFileName).toBe(`${bundle.fileName}.map`);
    }

    const appRecords = await findCacheRecords(cacheDir, "::src/App.jsx");
    expect(appRecords).toHaveLength(1);
    expect(Object.keys(appRecords[0].fileRecordsByEnv).sort()).toEqual([
      "client",
      "server",
    ]);
    for (const route of [
      "Dashboard.jsx",
      "Inventory.jsx",
      "Reports.jsx",
      "Settings.jsx",
    ]) {
      const routeRecords = await findCacheRecords(
        cacheDir,
        `::src/routes/${route}`,
      );
      expect(routeRecords).toHaveLength(1);
      expect(Object.keys(routeRecords[0].fileRecordsByEnv).sort()).toEqual([
        "client",
        "server",
      ]);
    }

    await withServer(exampleDir, "production", async (baseUrl) => {
      await expectHealthyPage(baseUrl, "/", example.title);
      await expectHealthyPage(baseUrl, example.route, example.heading);
    });

    await buildExample(exampleDir, "development");
    await withServer(exampleDir, "development", async (baseUrl) => {
      await expectHealthyPage(baseUrl, "/", example.title);
      await expectHealthyPage(baseUrl, example.route, example.heading);
    });
  });
}

test("react-spa-stylex dev serves only browser entries and publishes browser HMR patches", async () => {
  const exampleDir = path.join(rootDir, "examples/react-spa-stylex");
  const dashboardPath = path.join(exampleDir, "src/routes/Dashboard.jsx");
  const originalDashboard = await fs.readFile(dashboardPath, "utf8");
  const updatedDashboard = originalDashboard.replace(
    'backgroundColor: "#17231f"',
    'backgroundColor: "#1d3029"',
  );
  expect(updatedDashboard).not.toBe(originalDashboard);
  await execFileAsync("node", ["scripts/clean.mjs"], {
    cwd: exampleDir,
    env: process.env,
  });
  const port = await getFreePort();
  const child = spawn(
    "corepack",
    ["pnpm", "exec", "bundler", "dev", "--config", "bundler.config.mjs"],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        PORT: String(port),
        BUNDLER_MODE: "development",
        NODE_ENV: "development",
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
  let socket;
  try {
    await waitForServer(child, port, () => output);
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    expect(html.match(/<script type="module"/g)).toHaveLength(1);
    expect(html).toContain("client.client.client.");
    expect(html).not.toContain("server.server.server.");
    expect(html).not.toContain("Dashboard.client.");
    const clientEntryUrl = html.match(
      /<script type="module" src="([^"]+)"><\/script>/,
    )?.[1];
    expect(clientEntryUrl).toBeDefined();
    const clientEntry = await (
      await fetch(new URL(clientEntryUrl, `http://127.0.0.1:${port}`))
    ).text();
    expect(clientEntry).not.toContain("__bundler_load_css__");
    const routeResponse = await fetch(`http://127.0.0.1:${port}/inventory`, {
      headers: { accept: "text/html" },
    });
    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.text()).toContain('<div id="root"></div>');

    socket = new WebSocket(`ws://127.0.0.1:${port}/__bundler_hmr`);
    await waitForWebSocketOpen(socket);
    const nextMessage = waitForWebSocketMessage(socket);
    await fs.writeFile(dashboardPath, updatedDashboard, "utf8");
    const message = await nextMessage;
    expect(message.type).toBe("patch");
    expect(message.updates.length).toBeGreaterThan(0);
    expect(
      message.updates.every((update) => update.bundleKey.startsWith("client:")),
    ).toBe(true);
    expect(message.styles).toHaveLength(1);
    expect(message.styles[0]).toContain("/assets/stylex.all.");
  } finally {
    await fs.writeFile(dashboardPath, originalDashboard, "utf8");
    socket?.close();
    child.kill("SIGINT");
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
});

test("react-spa-stylex keeps StyleX definitions beside their components", async () => {
  const sourceRoot = path.join(rootDir, "examples/react-spa-stylex/src");
  const entries = await fs.readdir(sourceRoot, {
    recursive: true,
    withFileTypes: true,
  });
  expect(entries.some((entry) => entry.name === "styles.js")).toBe(false);
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:js|jsx)$/.test(entry.name)) continue;
    const source = await fs.readFile(
      path.join(entry.parentPath, entry.name),
      "utf8",
    );
    if (source.includes("stylex.props")) {
      expect(source).toContain("stylex.create");
    }
  }
});

function expectBundleShape(manifest) {
  const serverBundles = manifest.bundles.filter(
    (bundle) => bundle.envId === "server",
  );
  const clientBundles = manifest.bundles.filter(
    (bundle) => bundle.envId === "client",
  );
  expect(serverBundles).toHaveLength(6);
  expect(clientBundles).toHaveLength(6);
  expect(
    serverBundles.some((bundle) =>
      bundle.entryId.endsWith("client.client.jsx"),
    ),
  ).toBe(false);
  expect(
    clientBundles.some((bundle) =>
      bundle.entryId.endsWith("server.server.jsx"),
    ),
  ).toBe(false);
  const dynamicNames = (bundles) =>
    bundles
      .map((bundle) => path.basename(bundle.entryId))
      .filter((name) =>
        /^(Dashboard|Inventory|Reports|Settings)\.jsx$/.test(name),
      )
      .sort();
  expect(dynamicNames(serverBundles)).toEqual(dynamicNames(clientBundles));
}

function waitForWebSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out opening the HMR socket.")),
      10_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Failed to open the HMR socket."));
      },
      { once: true },
    );
  });
}

function waitForWebSocketMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for an HMR message.")),
      30_000,
    );
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(JSON.parse(event.data));
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("The HMR socket failed."));
      },
      { once: true },
    );
  });
}

async function buildExample(exampleDir, mode) {
  await execFileAsync("node", ["scripts/clean.mjs"], {
    cwd: exampleDir,
    env: process.env,
  });
  await execFileAsync(
    "corepack",
    ["pnpm", "exec", "bundler", "build", "--config", "bundler.config.mjs"],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        BUNDLER_MODE: mode,
        NODE_ENV: mode,
      },
      timeout: 60_000,
    },
  );
}

async function readManifest(exampleDir) {
  return JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
}

async function findCacheRecords(cacheDir, identitySuffix) {
  const files = await fs.readdir(cacheDir, {
    recursive: true,
    withFileTypes: true,
  });
  const records = [];
  for (const entry of files) {
    if (!entry.isFile() || entry.name !== "module.json") continue;
    const filePath = path.join(entry.parentPath, entry.name);
    const record = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (
      Object.values(record.fileRecordsByEnv ?? {}).some((fileRecord) =>
        (fileRecord.moduleIdentity ?? fileRecord.id ?? "").endsWith(
          identitySuffix,
        ),
      )
    ) {
      records.push(record);
    }
  }
  return records;
}

async function expectHealthyPage(baseUrl, route, expected) {
  const response = await fetch(`${baseUrl}${route}`);
  const text = await response.text();
  expect(response.status).toBe(200);
  expect(text).toContain(expected);
  expect(text).not.toContain("Internal server error");
}

async function withServer(exampleDir, mode, run) {
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
        PORT: String(port),
        BUNDLER_MODE: mode,
        NODE_ENV: mode,
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
  try {
    await waitForServer(child, port, () => output);
    await run(`http://127.0.0.1:${port}`);
    expect(output).not.toContain("document is not defined");
  } finally {
    child.kill("SIGINT");
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

async function waitForServer(child, port, readOutput) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`SPA server exited early:\n${readOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The server may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for SPA server:\n${readOutput()}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
