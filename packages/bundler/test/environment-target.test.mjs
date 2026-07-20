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

  await expect(
    buildProject(
      {
        ...config,
        environmentVariables: { "NOT-VALID": "value" },
      },
      [],
    ),
  ).rejects.toThrow("Environment variable name 'NOT-VALID' is invalid");

  await expect(
    buildProject(
      {
        ...config,
        environmentVariables: { NODE_ENV: true },
      },
      [],
    ),
  ).rejects.toThrow(
    "Environment variable 'NODE_ENV' must be configured with a string value",
  );
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
  expect(shared).not.toHaveProperty("targetId");
  expect(shared?.environmentId).toBe("first");
  expect(shared?.platform).toBe("browser");
  const entryPath = path.join(projectDir, "src/index.js");
  for (const scopeId of ["alpha::first", "beta::first"]) {
    expect(result.entrypoints[`${scopeId}:${entryPath}`].entryId).toBe(
      first[0].moduleIdentity,
    );
  }
  expect(result.entrypoints[`alpha::second:${entryPath}`].entryId).toBe(
    second[0].moduleIdentity,
  );
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

test("warm cache preserves target-specific package resolution when transform behavior is equal", async () => {
  const projectDir = await createProject("warm-target-resolution", {
    "src/index.js":
      'import value from "variant-package"; export const result = value;',
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
  const entryPath = path.join(projectDir, "src/index.js");
  const config = baseConfig(projectDir, {
    targets: {
      server: {
        platform: "node",
        packageResolver: resolver("@bundler/node-package-resolver", {
          browserField: false,
        }),
      },
      client: {
        platform: "browser",
        packageResolver: resolver("@bundler/browser-package-resolver", {
          browserField: true,
        }),
      },
    },
    entries: [
      {
        path: entryPath,
        environment: "app",
        targets: ["server", "client"],
      },
    ],
  });

  await buildProject(config, []);
  const warm = await buildProject(config, []);
  const readEntrypointClosure = async (scopeId) => {
    const entrypoint = warm.entrypoints[`${scopeId}:${entryPath}`];
    expect(entrypoint).toBeDefined();
    return (
      await Promise.all(
        entrypoint.bundles.map((fileName) =>
          fs.readFile(path.join(config.outputs.outDir, fileName), "utf8"),
        ),
      )
    ).join("\n");
  };
  const serverCode = await readEntrypointClosure("server::app");
  const clientCode = await readEntrypointClosure("client::app");

  expect(serverCode).toContain("node-resolution");
  expect(serverCode).not.toContain("browser-resolution");
  expect(clientCode).toContain("browser-resolution");
  expect(clientCode).not.toContain("node-resolution");
});

test("cache retains older resolution variants after a different resolution is added", async () => {
  const projectDir = await createProject("alternating-resolution-cache", {
    "src/index.js":
      'import value from "variant-package"; export const result = value;',
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
  const cacheDir = path.join(projectDir, ".cache");
  const withResolver = (module, options) =>
    baseConfig(projectDir, {
      cacheDir,
      debug: true,
      targets: {
        runtime: {
          platform: "browser",
          packageResolver: resolver(module, options),
        },
      },
      entries: [
        {
          path: path.join(projectDir, "src/index.js"),
          environment: "app",
          targets: ["runtime"],
        },
      ],
    });
  const nodeConfig = withResolver("@bundler/node-package-resolver", {
    browserField: false,
  });
  const browserConfig = withResolver("@bundler/browser-package-resolver", {
    browserField: true,
  });

  await buildProject(nodeConfig, []);
  await buildProject(browserConfig, []);
  await buildProject(nodeConfig, []);

  const debugRecords = (await walk(path.join(cacheDir, "__DEBUG__"))).filter(
    (filePath) => filePath.endsWith("record.json"),
  );
  const entryRecord = (
    await Promise.all(
      debugRecords.map(async (filePath) =>
        JSON.parse(await fs.readFile(filePath, "utf8")),
      ),
    )
  ).find((record) => record.input.canonicalPath.endsWith("::src/index.js"));
  expect(entryRecord.input.cacheHit).toBe(true);
});

test("concurrent builds safely share immutable transform-cache entries", async () => {
  const projectDir = await createProject("concurrent-cache-writers", {
    "src/index.js":
      'import { dependency } from "./dependency.js"; export const value = dependency;',
    "src/dependency.js": "export const dependency = 42;",
  });
  const cacheDir = path.join(projectDir, ".cache");
  const config = baseConfig(projectDir, { cacheDir });
  const alternate = {
    ...config,
    outputs: {
      ...config.outputs,
      outDir: path.join(projectDir, "dist-alternate"),
    },
  };

  const [first, second] = await Promise.all([
    buildProject(config, []),
    buildProject(alternate, []),
  ]);
  expect(first.bundles).toHaveLength(1);
  expect(second.bundles).toHaveLength(1);

  const cacheFiles = await walk(cacheDir);
  const inputRecords = cacheFiles.filter(
    (filePath) => path.basename(path.dirname(filePath)) === "inputs",
  );
  const variantRecords = cacheFiles.filter(
    (filePath) => path.basename(path.dirname(filePath)) === "scope-variants",
  );
  expect(inputRecords.length).toBeGreaterThanOrEqual(2);
  expect(variantRecords.length).toBeGreaterThanOrEqual(2);
  expect(cacheFiles.some((filePath) => filePath.endsWith(".lock"))).toBe(false);

  await Promise.all(
    inputRecords.map(async (filePath) => {
      const record = JSON.parse(await fs.readFile(filePath, "utf8"));
      expect(record.inputFingerprint).toBe(path.basename(filePath, ".json"));
      expect(Array.isArray(record.dependencyRequests)).toBe(true);
    }),
  );
  await Promise.all(
    variantRecords.map(async (filePath) => {
      const record = JSON.parse(await fs.readFile(filePath, "utf8"));
      expect(typeof record.inputFingerprint).toBe("string");
      expect(typeof record.resolutionFingerprint).toBe("string");
      expect(record.fileRecord).toBeDefined();
    }),
  );

  const initialMtimes = new Map(
    await Promise.all(
      [...inputRecords, ...variantRecords].map(async (filePath) => [
        filePath,
        (await fs.stat(filePath)).mtimeMs,
      ]),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  await expect(buildProject(config, [])).resolves.toBeDefined();
  await Promise.all(
    Array.from(initialMtimes, async ([filePath, mtimeMs]) => {
      expect((await fs.stat(filePath)).mtimeMs).toBe(mtimeMs);
    }),
  );
}, 15_000);

test("keeps target-selected URL facades distinct inside one importer", async () => {
  const projectDir = await createProject("target-selected-urls", {
    "src/index.js": `
      import clientUrl from "./route.js" with { as: "url", target: "client" };
      import serverUrl from "./route.js" with { as: "url", target: "server" };
      export const urls = [clientUrl, serverUrl];
    `,
    "src/route.js": "export const target = __TARGET_NAME__;",
  });
  const entryPath = path.join(projectDir, "src/index.js");
  const routePath = path.join(projectDir, "src/route.js");
  const config = baseConfig(projectDir, {
    targets: {
      client: {
        platform: "browser",
        defines: { __TARGET_NAME__: "client" },
      },
      server: {
        platform: "node",
        defines: { __TARGET_NAME__: "server" },
      },
    },
    entries: [
      {
        path: entryPath,
        environment: "app",
        targets: ["client"],
      },
    ],
  });

  const result = await buildProject(config, []);
  const routeBundles = result.bundles.filter(
    (bundle) => bundle.entryId === routePath,
  );
  expect(routeBundles).toHaveLength(2);
  const clientRoute = routeBundles.find((bundle) =>
    bundle.targetIds.includes("client"),
  );
  const serverRoute = routeBundles.find((bundle) =>
    bundle.targetIds.includes("server"),
  );
  expect(clientRoute.fileName).not.toBe(serverRoute.fileName);

  const entryBundle = result.bundles.find(
    (bundle) => bundle.entryId === entryPath,
  );
  const entryCode = await readBundle(config, entryBundle);
  expect(entryCode).toContain(`/${clientRoute.fileName}`);
  expect(entryCode).toContain(`/${serverRoute.fileName}`);
  expect(entryCode.match(/const __bundler_.*_output_url/g)).toHaveLength(2);
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

test("resource planners must explicitly describe no-resource equivalence", async () => {
  const projectDir = await createProject("resource-planner-equivalence", {
    "src/index.js": "export const value = 1;",
  });
  const config = baseConfig(projectDir, {
    targets: {
      first: { platform: "browser" },
      second: { platform: "browser" },
    },
    entries: [
      {
        path: path.join(projectDir, "src/index.js"),
        environment: "app",
        targets: ["first", "second"],
      },
    ],
  });
  const incomplete = {
    name: "incomplete-resource-planner",
    resourceFingerprint: "incomplete-resource-planner-v1",
    planBundleResources() {
      "incomplete-resource-planner-v1";
      return {};
    },
    generateBundleResources() {
      "incomplete-resource-generator-v1";
    },
  };
  const explicitNone = {
    ...incomplete,
    name: "explicit-none-resource-planner",
    resourceFingerprint: "explicit-none-resource-planner-v1",
    planBundleResources({ bundles }) {
      "explicit-none-resource-planner-v1";
      return Object.fromEntries(bundles.map((bundle) => [bundle.id, "none"]));
    },
  };

  const scoped = await buildProject(config, [incomplete]);
  const coalesced = await buildProject(
    {
      ...config,
      outputs: {
        ...config.outputs,
        outDir: path.join(projectDir, "dist-explicit-none"),
      },
    },
    [explicitNone],
  );

  expect(scoped.bundles).toHaveLength(2);
  expect(scoped.bundles.every((bundle) => bundle.targetIds.length === 1)).toBe(
    true,
  );
  expect(coalesced.bundles).toHaveLength(1);
  expect(coalesced.bundles[0].targetIds).toEqual(["first", "second"]);
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
