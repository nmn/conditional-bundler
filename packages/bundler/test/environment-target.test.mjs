import fs from "node:fs/promises";
import path from "node:path";
import { buildProject, plugin, resolver } from "../dist/index.js";

const rootDir = path.resolve(process.cwd());
const outRoot = path.join(rootDir, "test/.out/environment-target");
const testPlugin = path.join(
  rootDir,
  "packages/bundler/test/plugins/environment-target-plugin.mjs",
);

beforeEach(async () => {
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });
});

function baseConfig(projectDir, overrides = {}) {
  return {
    targets: {
      browser: {
        platform: "browser",
        packageResolver: resolver("@bundler/browser-package-resolver"),
      },
    },
    environments: {
      app: {},
    },
    entries: [
      {
        path: path.join(projectDir, "src/index.js"),
        environment: "app",
        targets: ["browser"],
      },
    ],
    outputs: {
      outDir: path.join(projectDir, "dist"),
      fileName: "[entry].[target].[environment].[hash].js",
    },
    cacheDir: path.join(projectDir, ".cache"),
    maxWorkers: 2,
    diagnostics: "human",
    ...overrides,
  };
}

async function createProject(name, files) {
  const projectDir = path.join(outRoot, name);
  await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ name: `environment-target-${name}`, version: "1.0.0" }),
  );
  await Promise.all(
    Object.entries(files).map(async ([fileName, contents]) => {
      const filePath = path.join(projectDir, fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents);
    }),
  );
  return projectDir;
}

function captureModules() {
  let modules = [];
  return {
    plugin: {
      name: "capture-modules",
      buildEnd(context) {
        "capture-modules-v1";
        modules = context.modules;
      },
    },
    read() {
      return modules;
    },
  };
}

async function readBundle(config, bundle) {
  return fs.readFile(path.join(config.outputs.outDir, bundle.fileName), "utf8");
}

test("rejects the removed env and entry-id shapes and keeps environments flat", async () => {
  const projectDir = await createProject("invalid-config", {
    "src/index.js": "export const value = 1;",
  });
  const config = baseConfig(projectDir);

  await expect(
    buildProject(
      {
        ...config,
        envs: { browser: { target: "browser" } },
      },
      [],
    ),
  ).rejects.toThrow("The 'envs' configuration was removed");

  await expect(
    buildProject(
      {
        ...config,
        entries: [{ ...config.entries[0], id: "arbitrary" }],
      },
      [],
    ),
  ).rejects.toThrow("removed 'id' field");

  await expect(
    buildProject(
      {
        ...config,
        environments: { app: { extends: "javascript" } },
      },
      [],
    ),
  ).rejects.toThrow("Environment 'app' is flat");
});

test("environment is part of module identity while target variants share one transform identity", async () => {
  const projectDir = await createProject("identity", {
    "src/index.js":
      "export const environment = __TRANSFORM_ENVIRONMENT__; export const value = 1;",
  });
  const captured = captureModules();
  const config = baseConfig(projectDir, {
    targets: {
      alpha: { platform: "browser" },
      beta: { platform: "browser" },
    },
    environments: {
      first: {},
      second: {},
    },
    entries: [
      {
        path: path.join(projectDir, "src/index.js"),
        environment: "first",
        targets: ["alpha", "beta"],
      },
      {
        path: path.join(projectDir, "src/index.js"),
        environment: "second",
        targets: ["alpha"],
      },
    ],
    plugins: [
      plugin(testPlugin, { environment: "first" }),
      {
        name: "second-environment-transform",
        // Exact environment selection is intentionally expressed through the
        // module-backed plugin above in the first environment. This hook only
        // captures the finalized records.
      },
    ],
  });

  const result = await buildProject(config, [captured.plugin]);
  const records = captured
    .read()
    .filter(
      (record) => record.filePath === path.join(projectDir, "src/index.js"),
    );
  const first = records.filter((record) => record.environment === "first");
  const second = records.filter((record) => record.environment === "second");

  expect(first).toHaveLength(1);
  expect(first[0].targetIds).toEqual(["alpha", "beta"]);
  expect(first[0].moduleIdentity.endsWith("::environment=first")).toBe(true);
  expect(second).toHaveLength(1);
  expect(second[0].targetIds).toEqual(["alpha"]);
  expect(second[0].moduleIdentity.endsWith("::environment=second")).toBe(true);
  expect(first[0].moduleIdentity).not.toBe(second[0].moduleIdentity);

  const shared = result.bundles.find(
    (bundle) =>
      bundle.environmentId === "first" &&
      bundle.targetIds.includes("alpha") &&
      bundle.targetIds.includes("beta"),
  );
  expect(shared?.scopeIds).toHaveLength(2);
});

test("target defines and package resolution split variants only when records differ", async () => {
  const projectDir = await createProject("target-variants", {
    "src/index.js":
      'import value from "variant-package"; export const result = [value, __SERVER__];',
    "node_modules/variant-package/package.json": JSON.stringify({
      name: "variant-package",
      version: "1.0.0",
      main: "node.js",
      browser: "browser.js",
    }),
    "node_modules/variant-package/node.js": 'export default "node-resolution";',
    "node_modules/variant-package/browser.js":
      'export default "browser-resolution";',
  });
  const captured = captureModules();
  const config = baseConfig(projectDir, {
    targets: {
      server: {
        platform: "node",
        packageResolver: resolver("@bundler/node-package-resolver", {
          browserField: false,
        }),
        defines: { __SERVER__: true },
      },
      client: {
        platform: "browser",
        packageResolver: resolver("@bundler/browser-package-resolver", {
          browserField: true,
        }),
        defines: { __SERVER__: false },
      },
    },
    entries: [
      {
        path: path.join(projectDir, "src/index.js"),
        environment: "app",
        targets: ["server", "client"],
      },
    ],
  });

  const result = await buildProject(config, [captured.plugin]);
  const records = captured
    .read()
    .filter(
      (record) => record.filePath === path.join(projectDir, "src/index.js"),
    );

  expect(records).toHaveLength(2);
  expect(records.map((record) => record.moduleIdentity)).toEqual([
    records[0].moduleIdentity,
    records[0].moduleIdentity,
  ]);
  expect(records.map((record) => record.targetIds).sort()).toEqual([
    ["client"],
    ["server"],
  ]);

  const serverBundle = result.bundles.find(
    (bundle) => bundle.targetId === "server",
  );
  const clientBundle = result.bundles.find(
    (bundle) => bundle.targetId === "client",
  );
  const serverCode = await readBundle(config, serverBundle);
  const clientCode = await readBundle(config, clientBundle);
  expect(serverCode).toContain("node-resolution");
  expect(serverCode).toContain("true");
  expect(clientCode).toContain("browser-resolution");
  expect(clientCode).toContain("false");
});

test("ordinary imports inherit environment and explicit imports switch it exactly", async () => {
  const projectDir = await createProject("environment-imports", {
    "src/index.js":
      'import inherited from "./dependency.js"; import switched from "./dependency.js" with { environment: "other" }; export default [inherited, switched];',
    "src/dependency.js": "export default 1;",
  });
  const captured = captureModules();
  const config = baseConfig(projectDir, {
    environments: {
      app: {},
      other: {},
    },
  });

  await buildProject(config, [captured.plugin]);
  const dependencyRecords = captured
    .read()
    .filter(
      (record) =>
        record.filePath === path.join(projectDir, "src/dependency.js"),
    );

  expect(
    dependencyRecords
      .map((record) =>
        record.moduleIdentity.slice(
          record.moduleIdentity.lastIndexOf("::environment="),
        ),
      )
      .sort(),
  ).toEqual(["::environment=app", "::environment=other"]);
});

test("custom representations inherit core as behavior without affecting environment semantics", async () => {
  const projectDir = await createProject("representation-subtype", {
    "src/index.js":
      'import assetUrl from "./asset.txt" with { as: "test-url", flavor: "link-only" }; export const asset = assetUrl;',
    "src/asset.txt": "representation inheritance",
  });
  const captured = captureModules();
  const config = baseConfig(projectDir, {
    plugins: [plugin(testPlugin)],
  });

  const result = await buildProject(config, [captured.plugin]);
  const representationRecord = captured
    .read()
    .find((record) => record.moduleIdentity?.includes("::as=test-url"));

  expect(representationRecord).toBeDefined();
  expect(representationRecord.environment).toBe("app");
  expect(representationRecord.moduleIdentity).not.toContain("attr=");
  expect(representationRecord.resolutionMeta).toMatchObject({
    representation: "test-url",
    representationBase: "url",
  });
  const code = await readBundle(config, result.bundles[0]);
  expect(code).toContain("/assets/");
});

test("adding an equivalent target reuses shared environment and core transform caches", async () => {
  const projectDir = await createProject("incremental-target", {
    "src/index.js":
      "export const environment = __TRANSFORM_ENVIRONMENT__; export const value = 1;",
  });
  const cacheDir = path.join(projectDir, ".cache");
  const oneTarget = baseConfig(projectDir, {
    cacheDir,
    plugins: [plugin(testPlugin)],
  });
  await buildProject(oneTarget, []);

  const sharedCache = path.join(cacheDir, "shared-transforms-v1");
  const before = await cacheFileTimes(sharedCache);

  const twoTargets = {
    ...oneTarget,
    targets: {
      browser: { platform: "browser" },
      equivalent: { platform: "browser" },
    },
    entries: [
      {
        ...oneTarget.entries[0],
        targets: ["browser", "equivalent"],
      },
    ],
  };
  await buildProject(twoTargets, []);
  const after = await cacheFileTimes(sharedCache);

  expect(after).toEqual(before);
});

async function cacheFileTimes(directory) {
  const result = {};
  for (const filePath of await walk(directory)) {
    const stat = await fs.stat(filePath);
    result[path.relative(directory, filePath)] = stat.mtimeMs;
  }
  return result;
}

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(filePath)));
    } else {
      files.push(filePath);
    }
  }
  return files.sort();
}
