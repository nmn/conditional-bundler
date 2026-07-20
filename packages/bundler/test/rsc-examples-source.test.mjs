import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(process.cwd());
const rscExamples = [
  "react-rsc-basic",
  "react-rsc-commerce",
  "react-rsc-commerce-stylex",
  "react-rsc-commerce-tailwind",
];
const spaExamples = ["react-spa-stylex", "react-spa-tailwind"];
const allExamples = [...rscExamples, ...spaExamples];
const commerceExamples = rscExamples.filter(
  (name) => name !== "react-rsc-basic",
);

test.each(rscExamples)(
  "%s owns its RSC server and React document root",
  async (name) => {
    const server = await readExampleSource(name, "server.jsx");
    const root = await readExampleSource(name, "Root.jsx");
    const client = await readExampleSource(name, "client.jsx");

    expect(server).toContain('from "./Root.jsx"');
    expect(server).toContain(
      'import { renderToPipeableStream } from "react-dom/server.node"',
    );
    expect(server).toContain("<Root");
    expect(server).toContain("app={initialRoute.model}");
    expect(server).toContain("stream.pipe(response)");
    expect(server).not.toContain("renderReactMarkup");
    expect(server).not.toContain("prerenderToNodeStream");
    expect(server).not.toContain("clientScript=");
    expect(server).not.toMatch(/@bundler\/rsc-example-server/);
    expect(server).not.toMatch(/<!doctype|<html[\s>]/i);
    expect(server).not.toMatch(/<style[\s>]/i);
    expect(server).not.toMatch(/\bconst style\s*=\s*`/);

    expect(root).toContain("<html");
    expect(root).toContain("<head>");
    expect(root).toContain("<body");
    expect(root).toContain('id="root"');
    expect(root).toContain('<div id="root">{app}</div>');
    expect(root).not.toContain("__html: appMarkup");
    expect(root).toContain('id="__BUNDLER_RSC_DATA__"');
    expect(root).toContain('from "./client.jsx" with {');
    expect(root).toContain('as: "url"');
    expect(root).toContain('environment: "react.client"');
    expect(root).toContain('target: "client"');
    expect(root).toContain("applyConditionIdToUrl(");
    expect(root).toContain("conditionId");
    expect(root).toContain("conditionNames");
    expect(root).not.toMatch(/<!doctype/i);
    expect(client).toContain(
      'import "@bundler/react-rsc-plugin/runtime-client"',
    );
  },
);

test.each(spaExamples)(
  "%s owns its SPA server and React document root",
  async (name) => {
    const server = await readExampleSource(name, "server.server.jsx");
    const root = await readExampleSource(name, "Root.jsx");

    expect(server).toContain('from "./Root.jsx"');
    expect(server).toContain(
      'import { renderToPipeableStream } from "react-dom/server.node"',
    );
    expect(server).toContain("<Root");
    expect(server).toContain("<App");
    expect(server).toContain("stream.pipe(response)");
    expect(server).not.toContain("renderReactMarkup");
    expect(server).not.toContain("prerenderToNodeStream");
    expect(server).not.toContain("clientScript=");
    expect(server).not.toMatch(/@bundler\/spa-example-server/);
    expect(server).not.toMatch(/<!doctype|<html[\s>]/i);
    expect(server).not.toMatch(/<style[\s>]/i);

    expect(root).toContain("<html");
    expect(root).toContain("<head>");
    expect(root).toContain("<body");
    expect(root).toContain('id="root"');
    expect(root).toContain('<div id="root">{children}</div>');
    expect(root).not.toContain("__html: appMarkup");
    expect(root).toContain('from "./client.client.jsx" with {');
    expect(root).toContain('as: "url"');
    expect(root).toContain('environment: "javascript"');
    expect(root).toContain('target: "client"');
    expect(root).toContain("applyConditionIdToUrl(");
    expect(root).toContain("conditionId");
    expect(root).toContain("conditionNames");
    expect(root).not.toMatch(/<!doctype/i);
  },
);

test.each(commerceExamples)(
  "%s exposes navigation as an explicit client component",
  async (name) => {
    const sourceRoot = path.join(rootDir, "examples", name, "src");
    const app = await fs.readFile(path.join(sourceRoot, "App.jsx"), "utf8");
    const router = await fs.readFile(
      path.join(sourceRoot, "client/Router.jsx"),
      "utf8",
    );

    expect(router.trimStart()).toMatch(/^["']use client["'];/);
    expect(router).toContain('new CustomEvent("bundler:rsc-navigate"');
    expect(router).toContain('data-router="client"');
    expect(app).toContain('from "./client/Router.jsx"');
    expect(app).toContain("<Router>");
    expect(app).toContain('from "./routes.js"');
    await expect(
      fs.access(path.join(sourceRoot, "router.js")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  },
);

test.each(allExamples)(
  "%s demonstrates Chrome, Firefox, Safari, and Unknown conditional imports",
  async (name) => {
    const sourceRoot = path.join(rootDir, "examples", name, "src");
    const proof = await fs.readFile(
      path.join(sourceRoot, "BrowserString.jsx"),
      "utf8",
    );
    expect(proof).toContain('condition: "isChrome"');
    expect(proof).toContain('condition: "isFirefox"');
    expect(proof).toContain('condition: "isSafari"');
    expect(proof).toContain('else: "./StringForUnknown.jsx"');
    expect(proof).toContain(
      "BrowserStringChrome ?? BrowserStringFirefox ?? BrowserStringSafari",
    );
    for (const browser of ["Chrome", "Firefox", "Safari", "Unknown"]) {
      await expect(
        fs.readFile(path.join(sourceRoot, `StringFor${browser}.jsx`), "utf8"),
      ).resolves.toContain(`${browser} browser variant`);
    }
    const config = await fs.readFile(
      path.join(rootDir, "examples", name, "bundler.config.mjs"),
      "utf8",
    );
    expect(config).toContain("environmentVariables:");
    expect(config).toContain('NODE_ENV: process.env.NODE_ENV ?? "development"');
  },
);

test("examples keep their styling systems at the component layer", async () => {
  const basicApp = await readExampleSource("react-rsc-basic", "App.jsx");
  const commerceApp = await readExampleSource("react-rsc-commerce", "App.jsx");
  const rscStylexApp = await readExampleSource(
    "react-rsc-commerce-stylex",
    "App.jsx",
  );
  const rscStylexRoot = await readExampleSource(
    "react-rsc-commerce-stylex",
    "Root.jsx",
  );
  const rscTailwindApp = await readExampleSource(
    "react-rsc-commerce-tailwind",
    "App.jsx",
  );
  const rscTailwindRoot = await readExampleSource(
    "react-rsc-commerce-tailwind",
    "Root.jsx",
  );
  const spaStylexRoot = await readExampleSource("react-spa-stylex", "Root.jsx");
  const spaTailwindRoot = await readExampleSource(
    "react-spa-tailwind",
    "Root.jsx",
  );

  expect(basicApp).toContain('from "./App.module.css"');
  expect(basicApp).toContain('import "./showcase.css"');
  expect(commerceApp).toContain('from "./App.module.css"');
  expect(commerceApp).toContain('import "./showcase.css"');
  expect(rscStylexApp).toContain('from "@stylexjs/stylex"');
  expect(rscStylexApp).toContain("stylex.create");
  expect(rscStylexRoot).toContain("stylex.create");
  expect(rscTailwindApp).toContain('className="min-h-dvh bg-paper');
  expect(rscTailwindRoot).toContain('className="m-0 min-w-80"');
  expect(spaStylexRoot).toContain("stylex.create");
  expect(spaTailwindRoot).toContain('className="m-0 min-w-80"');
});

test("example-only server packages are removed from the workspace", async () => {
  for (const packageName of ["rsc-example-server", "spa-example-server"]) {
    await expect(
      fs.access(path.join(rootDir, "packages", packageName, "package.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  }

  for (const name of allExamples) {
    const packageJson = JSON.parse(
      await fs.readFile(
        path.join(rootDir, "examples", name, "package.json"),
        "utf8",
      ),
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      "@bundler/rsc-example-server",
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      "@bundler/spa-example-server",
    );
  }
});

function readExampleSource(name, fileName) {
  return fs.readFile(
    path.join(rootDir, "examples", name, "src", fileName),
    "utf8",
  );
}
