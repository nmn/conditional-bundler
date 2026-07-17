import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const exampleDir = path.join(rootDir, "examples/react-rsc-commerce-stylex");

jest.setTimeout(120_000);

test("StyleX commerce works in production without browser code in RSC bundles", async () => {
  await expectColocatedStyleX();
  await execFileAsync("corepack", ["pnpm", "run", "build"], {
    cwd: exampleDir,
    env: process.env,
    timeout: 60_000,
  });
  const manifest = await readManifest();
  const clientManifest = await readClientManifest();
  expectClientComponentParity(clientManifest);
  const serverBundle = manifest.bundles.find(
    (bundle) =>
      bundle.envId === "rsc" && bundle.entryId.endsWith("src/server.jsx"),
  );
  const serverCode = await fs.readFile(
    path.join(exampleDir, "dist", serverBundle.fileName),
    "utf8",
  );
  expect(serverCode).not.toContain("__bundler_load_css__");
  expect(serverCode).not.toContain('document.createElement("link")');
  expect(
    manifest.bundles.some((bundle) =>
      bundle.entryId.includes("react-rsc-commerce/src/routes/"),
    ),
  ).toBe(false);
  expect(
    manifest.bundles.some((bundle) =>
      bundle.entryId.includes("react-rsc-commerce/src/client/"),
    ),
  ).toBe(false);
  const styles = manifest.assets.filter((asset) => asset.type === "style");
  expect(styles).toHaveLength(1);
  expect(styles[0]).toMatchObject({
    bundleKey: "stylex:global",
    global: true,
  });
  for (const style of styles) {
    const css = await fs.readFile(
      path.join(exampleDir, "dist", style.fileName),
      "utf8",
    );
    expect(css.length).toBeGreaterThan(100);
    await expect(
      fs.stat(path.join(exampleDir, "dist", `${style.fileName}.map`)),
    ).resolves.toBeDefined();
  }

  await withServer("start", async (baseUrl) => {
    await expectHealthyRoutes(baseUrl);
    await expectClientChunks(baseUrl, clientManifest);
  });
});

test("StyleX commerce development serves SSR and RSC routes", async () => {
  await withServer("dev", async (baseUrl) => {
    await expectHealthyRoutes(baseUrl);
  });
});

test("StyleX commerce hot reloads global CSS with RSC refreshes", async () => {
  const appPath = path.join(exampleDir, "src/App.jsx");
  const originalApp = await fs.readFile(appPath, "utf8");
  const updatedApp = originalApp.replace(
    'backgroundColor: "#f5eee1"',
    'backgroundColor: "#f0d9c2"',
  );
  expect(updatedApp).not.toBe(originalApp);
  try {
    await withServer("dev", async (baseUrl) => {
      const initialHtml = await (await fetch(baseUrl)).text();
      const style = (await readManifest()).assets.find(
        (asset) => asset.type === "style",
      );
      expect(initialHtml).toContain(`data-bundler-style="${style.bundleKey}"`);
      const socketUrl = new URL("/__bundler_hmr", baseUrl);
      socketUrl.protocol = "ws:";
      const socket = new WebSocket(socketUrl);
      try {
        await waitForWebSocketOpen(socket);
        const nextMessage = waitForWebSocketMessage(socket);
        await fs.writeFile(appPath, updatedApp, "utf8");
        const message = await nextMessage;
        expect(message.type).toBe("rsc-refresh");
        expect(message.styles).toHaveLength(1);
        expect(message.styles[0]).toContain("/assets/stylex.all.");
        expect(
          new URL(message.styles[0], baseUrl).searchParams.get("key"),
        ).toBe(style.bundleKey);
      } finally {
        socket.close();
      }
    });
  } finally {
    await fs.writeFile(appPath, originalApp, "utf8");
  }
});

test("StyleX commerce hot reloads client component styles", async () => {
  const counterPath = path.join(exampleDir, "src/client/HomeCounter.jsx");
  const originalCounter = await fs.readFile(counterPath, "utf8");
  const buttonStyle = originalCounter.match(
    /(button:\s*{\s*backgroundColor:\s*)"([^"]+)"/,
  );
  expect(buttonStyle).not.toBeNull();
  const nextColor = buttonStyle?.[2] === "#00ff00" ? "#00ff01" : "#00ff00";
  const updatedCounter = originalCounter.replace(
    buttonStyle?.[0] ?? "",
    `${buttonStyle?.[1]}"${nextColor}"`,
  );
  expect(updatedCounter).not.toBe(originalCounter);

  try {
    await withServer("dev", async (baseUrl) => {
      const socketUrl = new URL("/__bundler_hmr", baseUrl);
      socketUrl.protocol = "ws:";
      const socket = new WebSocket(socketUrl);
      try {
        await waitForWebSocketOpen(socket);
        const nextMessage = waitForWebSocketMessage(socket);
        await fs.writeFile(counterPath, updatedCounter, "utf8");
        const message = await nextMessage;

        expect(message.type).toBe("patch");
        expect(message.styles).toHaveLength(1);
        expect(message.imports).toHaveLength(1);
        expect(message.imports[0]).toContain("/HomeCounter.client.");
        expect(message.changedBundles).toEqual([
          expect.stringMatching(/client:.*\/src\/client\/HomeCounter\.jsx$/),
        ]);
        expect(Object.keys(message.rscChunks ?? {})).toEqual([
          expect.stringMatching(/\/src\/client\/HomeCounter\.jsx$/),
        ]);

        const clientChunk = await fetch(new URL(message.imports[0], baseUrl));
        expect(clientChunk.status).toBe(200);
        expect(await clientChunk.text()).toContain(
          "HomeCounter__styles.button",
        );

        const stylesheet = await fetch(new URL(message.styles[0], baseUrl));
        expect(stylesheet.status).toBe(200);
        expect(await stylesheet.text()).toContain(nextColor);
      } finally {
        socket.close();
      }
    });
  } finally {
    await fs.writeFile(counterPath, originalCounter, "utf8");
  }
});

async function expectHealthyRoutes(baseUrl) {
  for (const route of [
    "/",
    "/catalog",
    "/product/copper-kettle",
    "/cart",
    "/checkout",
    "/orders",
    "/account",
    "/journal",
    "/search",
    "/support",
  ]) {
    const response = await fetch(`${baseUrl}${route}`);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("Monarch Goods");
    expect(text).not.toContain("Internal server error");
  }
  const rsc = await fetch(`${baseUrl}/rsc?path=%2Fcatalog`);
  expect(rsc.status).toBe(200);
  expect(rsc.headers.get("content-type")).toContain("text/x-component");
  expect((await rsc.text()).length).toBeGreaterThan(500);
}

async function expectColocatedStyleX() {
  const sourceRoot = path.join(exampleDir, "src");
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
}

function expectClientComponentParity(clientManifest) {
  const ids = Object.values(clientManifest).map((record) => record.id);
  for (const fileName of [
    "CartContext.jsx",
    "CartTable.jsx",
    "CategoryPicker.jsx",
    "CommerceChrome.jsx",
    "DeliveryEstimator.jsx",
    "HomeCounter.jsx",
    "ProductActions.jsx",
  ]) {
    expect(ids.some((id) => id.endsWith(`/src/client/${fileName}`))).toBe(true);
  }
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

async function expectClientChunks(baseUrl, clientManifest) {
  const urls = Array.from(
    new Set(Object.values(clientManifest).map((record) => record.url)),
  );
  expect(urls.length).toBeGreaterThanOrEqual(7);
  for (const url of urls) {
    expect(url).toMatch(/^\/[^/].*\.js$/);
    const response = await fetch(new URL(url, baseUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect((await response.text()).trimStart()).not.toMatch(/^<!doctype/i);
  }
}

async function readManifest() {
  return JSON.parse(
    await fs.readFile(path.join(exampleDir, "dist/manifest.json"), "utf8"),
  );
}

async function readClientManifest() {
  return JSON.parse(
    await fs.readFile(
      path.join(exampleDir, "dist/rsc-client-manifest.json"),
      "utf8",
    ),
  );
}

async function withServer(script, run) {
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
      `scripts/${script}.mjs`,
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        PORT: String(port),
        BUNDLER_COMMERCE_SERVER_LIBRARY: "1",
        BUNDLER_MODE: script === "dev" ? "development" : "production",
        NODE_ENV: script === "dev" ? "development" : "production",
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
    expect(output).not.toContain("Assignment to constant variable");
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
      throw new Error(`StyleX server exited early:\n${readOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The server may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for StyleX server:\n${readOutput()}`);
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
