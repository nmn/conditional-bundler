import { spawn, execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const exampleDir = path.join(rootDir, "examples/react-rsc-commerce");

jest.setTimeout(45_000);

test("react-rsc-commerce production server serves HTML and RSC routes", async () => {
  await execFileAsync(
    "corepack",
    ["pnpm", "--filter", "react-rsc-commerce", "build"],
    {
      cwd: rootDir,
    },
  );
  const clientManifest = JSON.parse(
    await fs.readFile(
      path.join(exampleDir, "dist/rsc-client-manifest.json"),
      "utf8",
    ),
  );
  const productActionRef =
    clientManifest["src/client/ProductActions.jsx#ProductActions"];
  expect(productActionRef.name).toMatch(/_ProductActions$/);
  expect(productActionRef.chunks).toEqual([
    productActionRef.id,
    productActionRef.id,
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

  try {
    await waitForHttp(`http://localhost:${port}/`);
    const html = await fetchText(`http://localhost:${port}/`);
    expect(html).toContain("Monarch Goods");
    expect(html).toMatch(
      /<script type="module" src="\/assets\/client\.client\.[a-z0-9]+\.js"><\/script>/,
    );

    const catalog = await fetchText(
      `http://localhost:${port}/rsc?path=${encodeURIComponent("/catalog?category=Coffee")}`,
    );
    expect(catalog).toContain('"path":"/catalog?category=Coffee"');
    expect(catalog).toContain("ProductActions.client");
    expect(catalog).not.toContain(":E");

    const product = await fetchText(
      `http://localhost:${port}/rsc?path=${encodeURIComponent("/product/copper-kettle")}`,
    );
    expect(product).toContain('"path":"/product/copper-kettle"');
    expect(product).toContain("ProductActions.client");
    expect(product).not.toContain(":E");
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
});

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function waitForHttp(url) {
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
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
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
