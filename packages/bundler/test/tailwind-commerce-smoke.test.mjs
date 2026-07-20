import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const exampleDir = path.join(rootDir, "examples/react-rsc-commerce-tailwind");

jest.setTimeout(120_000);

test("Tailwind commerce emits one linked stylesheet and works in production", async () => {
  await execFileAsync("corepack", ["pnpm", "run", "build"], {
    cwd: exampleDir,
    env: process.env,
    timeout: 60_000,
  });
  const manifest = await readManifest();
  const clientReferences = manifest.metadata.rsc.clientReferenceBundles;
  expect(manifest.metadata.rsc.inline).toBe(true);
  expectClientComponentParity(clientReferences);
  await expect(
    fs.access(path.join(exampleDir, "dist/rsc-client-manifest.json")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  const styles = manifest.assets.filter((asset) => asset.type === "style");
  expect(styles).toHaveLength(1);
  expect(styles[0].fileName).toMatch(/^tailwind\.all\.all\.[a-z0-9]+\.css$/);
  const css = await fs.readFile(
    path.join(exampleDir, "dist", styles[0].fileName),
    "utf8",
  );
  expect(css).toContain(".bg-acid");
  expect(css).toContain(".text-ink");
  expect(css).toContain("body");
  await expect(
    fs.stat(path.join(exampleDir, "dist", `${styles[0].fileName}.map`)),
  ).resolves.toBeDefined();

  const serverBundle = manifest.bundles.find(
    (bundle) =>
      bundle.targetIds.includes("server") &&
      bundle.environmentIds.includes("react.server") &&
      bundle.entryId.endsWith("src/server.jsx"),
  );
  const serverCode = await fs.readFile(
    path.join(exampleDir, "dist", serverBundle.fileName),
    "utf8",
  );
  expect(serverCode).not.toContain("__bundler_load_css__");
  expect(serverCode).not.toContain('document.createElement("link")');

  await withServer("start", async (baseUrl) => {
    await expectHealthyRoutes(baseUrl);
    await expectClientChunks(baseUrl, manifest, clientReferences);
  });
});

test("Tailwind commerce development serves SSR and RSC routes", async () => {
  await withServer("dev", async (baseUrl) => {
    await expectHealthyRoutes(baseUrl);
  });
});

test("Tailwind commerce replaces the initial stylesheet during HMR", async () => {
  const cssPath = path.join(exampleDir, "src/tailwind.css");
  const originalCss = await fs.readFile(cssPath, "utf8");
  const updatedCss = originalCss.replace("#d7ff45", "#d8ff46");
  expect(updatedCss).not.toBe(originalCss);
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
        await fs.writeFile(cssPath, updatedCss, "utf8");
        const message = await nextMessage;
        expect(message.type).toBe("patch");
        expect(message.updates).toEqual([]);
        expect(message.changedBundles).toEqual([]);
        expect(message.styles).toHaveLength(1);
        const updateUrl = new URL(message.styles[0], baseUrl);
        expect(updateUrl.pathname).toMatch(
          /^\/assets\/tailwind\.all\.all\.[a-z0-9]+\.css$/,
        );
        expect(updateUrl.searchParams.get("key")).toBe(style.bundleKey);
      } finally {
        socket.close();
      }
    });
  } finally {
    await fs.writeFile(cssPath, originalCss, "utf8");
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
    expect(text).toMatch(/^<!DOCTYPE html>/);
    expect(text).toContain('<html lang="en">');
    expect(text).toContain('data-router="client"');
    expect(text).not.toContain("<style>");
    expect(text).toContain("Monarch Goods");
    expect(text).not.toContain("Internal server error");
  }
  const rsc = await fetch(`${baseUrl}/rsc?path=%2Fcatalog`);
  expect(rsc.status).toBe(200);
  expect(rsc.headers.get("content-type")).toContain("text/x-component");
  expect((await rsc.text()).length).toBeGreaterThan(500);
}

function expectClientComponentParity(clientReferences) {
  const ids = Object.keys(clientReferences);
  for (const fileName of [
    "../BrowserString.jsx",
    "CartContext.jsx",
    "CartTable.jsx",
    "CategoryPicker.jsx",
    "CommerceChrome.jsx",
    "DeliveryEstimator.jsx",
    "HomeCounter.jsx",
    "ProductActions.jsx",
    "Router.jsx",
  ]) {
    expect(ids).toContain(
      fileName.startsWith("../")
        ? `/src/${fileName.slice(3)}`
        : `/src/client/${fileName}`,
    );
  }
  expect(
    new Set(
      ["CategoryPicker", "DeliveryEstimator", "HomeCounter"].map(
        (name) => clientReferences[`/src/client/${name}.jsx`].client,
      ),
    ).size,
  ).toBe(1);
}

async function expectClientChunks(baseUrl, manifest, clientReferences) {
  const urls = clientReferenceChunkUrls(manifest, clientReferences);
  expect(urls.length).toBeGreaterThanOrEqual(5);
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

function clientReferenceChunkUrls(manifest, clientReferences) {
  const entrypoints = Object.values(manifest.entrypoints ?? {});
  return Array.from(
    new Set(
      Object.values(clientReferences).flatMap((reference) => {
        const entrypoint = entrypoints.find(
          (candidate) => candidate.bundleId === reference.client,
        );
        return (entrypoint?.bundles ?? []).map(
          (fileName) => `/${conditionFileName(fileName, "0")}`,
        );
      }),
    ),
  );
}

function conditionFileName(fileName, id) {
  return fileName.replace(/\.js$/, `.id-${id}.js`);
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
      `scripts/${script}.mjs`,
    ],
    {
      cwd: exampleDir,
      env: {
        ...process.env,
        PORT: String(port),
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
      throw new Error(`Tailwind server exited early:\n${readOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The server may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Tailwind server:\n${readOutput()}`);
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

function waitForWebSocketOpen(socket) {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
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
