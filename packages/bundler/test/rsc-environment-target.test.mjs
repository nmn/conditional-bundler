import fs from "node:fs/promises";
import path from "node:path";
import { buildProject, plugin, resolver } from "../dist/index.js";

const rootDir = path.resolve(process.cwd());
const projectDir = path.join(rootDir, "test/.out/rsc-environment-target");
const sourceDir = path.join(projectDir, "src");
const outDir = path.join(projectDir, "dist");

beforeEach(async () => {
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name: "rsc-environment-target-test",
      version: "1.0.0",
      type: "module",
    }),
  );
  await fs.symlink(
    path.join(rootDir, "examples/react-rsc-basic/node_modules"),
    path.join(projectDir, "node_modules"),
    "dir",
  );
  await fs.writeFile(
    path.join(sourceDir, "server.jsx"),
    [
      'import React from "react";',
      'import { Boundary } from "./Boundary.jsx";',
      "export default function App() {",
      "  return <Boundary label={React.version} />;",
      "}",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(sourceDir, "Boundary.jsx"),
    [
      '"use client";',
      'import React, { useState } from "react";',
      "globalThis.__RSC_CLIENT_SIDE_EFFECT__ =",
      "  (globalThis.__RSC_CLIENT_SIDE_EFFECT__ ?? 0) + 1;",
      "export function Boundary({ label }) {",
      "  const [count] = useState(1);",
      "  return <button>{label}:{count}:{React.version}</button>;",
      "}",
    ].join("\n"),
  );
});

test("RSC references and client implementations use independent environment and target variants", async () => {
  let modules = [];
  const capture = {
    name: "capture-rsc-module-variants",
    buildEnd(context) {
      "capture-rsc-module-variants-v1";
      modules = context.modules;
    },
  };
  const config = {
    targets: {
      server: {
        platform: "node",
        packageResolver: resolver("@bundler/node-package-resolver"),
      },
      client: {
        platform: "browser",
        packageResolver: resolver("@bundler/browser-package-resolver"),
      },
    },
    environments: {
      "react.server": {},
      "react.client": {},
    },
    entries: [
      {
        path: path.join(sourceDir, "server.jsx"),
        environment: "react.server",
        targets: ["server"],
      },
    ],
    outputs: {
      outDir,
      fileName: "[entry].[target].[environment].[hash].js",
      manifestFile: "manifest.json",
    },
    plugins: [
      plugin("@bundler/react-rsc-plugin", {
        root: projectDir,
        clientEntry: false,
        runtimeEntry: false,
      }),
      plugin("@bundler/cjs-to-esm/bundler"),
    ],
    cacheDir: path.join(projectDir, ".cache"),
    maxWorkers: 2,
    diagnostics: "human",
  };

  const result = await buildProject(config, [capture]);
  const boundaryPath = path.join(sourceDir, "Boundary.jsx");
  const boundaryRecords = modules.filter(
    (record) => record.filePath === boundaryPath,
  );
  const referenceRecord = boundaryRecords.find(
    (record) => record.environment === "react.server",
  );
  const implementationRecords = boundaryRecords.filter(
    (record) =>
      record.environment === "react.client" &&
      record.resolutionMeta?.representation === undefined,
  );

  expect(referenceRecord).toBeDefined();
  expect(referenceRecord.targetIds).toEqual(["server"]);
  expect(implementationRecords).toHaveLength(1);
  expect(implementationRecords[0].targetIds).toEqual(["client", "server"]);
  expect(referenceRecord.moduleIdentity).toContain(
    "::environment=react.server",
  );
  expect(implementationRecords[0].moduleIdentity).toContain(
    "::environment=react.client",
  );

  expect(referenceRecord.imports.map((item) => item.request)).toEqual(
    expect.arrayContaining([
      "./Boundary.jsx",
      "@bundler/react-server-dom/server",
    ]),
  );
  expect(implementationRecords[0].imports.map((item) => item.request)).toEqual(
    expect.arrayContaining(["react", "react/jsx-runtime"]),
  );

  const serverRecord = modules.find(
    (record) => record.filePath === path.join(sourceDir, "server.jsx"),
  );
  expect(serverRecord.imports.map((item) => item.request)).toEqual(
    expect.arrayContaining(["react-server", "react-server/jsx-runtime"]),
  );
  expect(serverRecord.imports.map((item) => item.request)).not.toContain(
    "react",
  );

  const serverRoot = result.bundles.find(
    (bundle) =>
      bundle.targetId === "server" &&
      bundle.environmentId === "react.server" &&
      bundle.entryId === path.join(sourceDir, "server.jsx"),
  );
  const browserImplementation = result.bundles.find(
    (bundle) =>
      bundle.targetIds.includes("client") &&
      bundle.environmentId === "react.client" &&
      bundle.entryId === boundaryPath,
  );
  const serverImplementation = result.bundles.find(
    (bundle) =>
      bundle.targetIds.includes("server") &&
      bundle.environmentId === "react.client" &&
      bundle.entryId === boundaryPath,
  );
  expect(serverRoot).toBeDefined();
  expect(browserImplementation).toBeDefined();
  expect(serverImplementation).toBeDefined();
  expect(browserImplementation.id).toBe(serverImplementation.id);

  const serverCode = await readBundle(serverRoot);
  const browserImplementationCode = await readBundle(browserImplementation);
  const serverImplementationCode = await readBundle(serverImplementation);
  expect(serverCode).toContain('"/src/Boundary.jsx"');
  expect(serverCode).toContain(`"/${browserImplementation.fileName}"`);
  expect(serverCode).toContain(
    `new URL("./${serverImplementation.fileName}", import.meta.url).href`,
  );
  expect(serverCode).not.toContain("__RSC_CLIENT_SIDE_EFFECT__");
  expect(browserImplementationCode).toContain("__RSC_CLIENT_SIDE_EFFECT__");
  expect(serverImplementationCode).toContain("__RSC_CLIENT_SIDE_EFFECT__");

  const emittedNames = await fs.readdir(outDir);
  expect(emittedNames).not.toContain("rsc-client-manifest.json");
  const emittedJavaScript = (
    await Promise.all(
      emittedNames
        .filter((fileName) => fileName.endsWith(".js"))
        .map((fileName) => fs.readFile(path.join(outDir, fileName), "utf8")),
    )
  ).join("\n");
  expect(emittedJavaScript).not.toContain("__webpack");
  expect(emittedJavaScript).not.toContain("__BUNDLER_RSC_CHUNKS__");
  expect(emittedJavaScript).not.toContain("__BUNDLER_RSC_NODE_MODULE_CACHE__");
  expect(result.manifest.metadata.rsc.clientReferenceBundles).toEqual({
    "/src/Boundary.jsx": {
      client: browserImplementation.id,
      server: serverImplementation.id,
    },
  });
});

async function readBundle(bundle) {
  return fs.readFile(path.join(outDir, bundle.fileName), "utf8");
}
