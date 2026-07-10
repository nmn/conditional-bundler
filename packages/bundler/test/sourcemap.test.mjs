import fs from "node:fs/promises";
import path from "node:path";
import { AnyMap, originalPositionFor } from "@jridgewell/trace-mapping";

const rootDir = path.resolve(process.cwd());
const fixturesDir = path.join(rootDir, "test/fixtures");
const outRoot = path.join(rootDir, "test/.out/source-maps");
const cacheRoot = path.join(rootDir, "tmp/test-cache/source-maps");

async function buildSimple(mode, plugins = [], options = {}) {
  const outDir = path.join(outRoot, mode);
  const cacheDir = path.join(cacheRoot, mode);
  await fs.rm(outDir, { recursive: true, force: true });
  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: {
        browser: { conditions: ["default"], target: "browser" },
      },
      entries: [
        {
          id: "simple",
          path: path.join(fixturesDir, "simple/src/index.js"),
        },
      ],
      outputs: {
        outDir,
        fileName: "simple.[env].[hash].js",
        sourceMap:
          options.sourceMap ??
          (mode.startsWith("hidden") ? "hidden" : "external"),
      },
      cacheDir: options.cacheDir ?? cacheDir,
      cache: options.cache,
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
      plugins,
      dev: options.dev,
    },
    [],
  );
  return { result, outDir, cacheDir };
}

function generatedPosition(code, search) {
  const index = code.indexOf(search);
  expect(index).toBeGreaterThanOrEqual(0);
  const prefix = code.slice(0, index);
  const lines = prefix.split("\n");
  return { line: lines.length, column: lines.at(-1).length };
}

test("emits one indexed map whose cell sections trace across modules", async () => {
  const { result, outDir } = await buildSimple("external");
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
  const rawMap = await fs.readFile(
    path.join(outDir, bundle.mapFileName),
    "utf8",
  );
  const parsedMap = JSON.parse(rawMap);
  const traceMap = new AnyMap(parsedMap);

  expect(parsedMap.version).toBe(3);
  expect(parsedMap.file).toBe(bundle.fileName);
  expect(parsedMap.sections.length).toBeGreaterThanOrEqual(3);
  expect(code).toContain(`//# sourceMappingURL=${bundle.mapFileName}`);
  expect(result.manifest.bundles[0].mapFileName).toBe(bundle.mapFileName);
  expect(result.manifest.assets).toContainEqual(
    expect.objectContaining({
      fileName: bundle.mapFileName,
      type: "source-map",
    }),
  );

  const entryPosition = generatedPosition(code, "const a33jpi1jb_value");
  const entryOriginal = originalPositionFor(traceMap, entryPosition);
  expect(entryOriginal.source).toMatch(/fixtures\/simple\/src\/index\.js$/);
  expect(entryOriginal.line).toBe(4);

  const dependencyPosition = generatedPosition(code, "const k7isotkd_foo");
  const dependencyOriginal = originalPositionFor(traceMap, dependencyPosition);
  expect(dependencyOriginal.source).toMatch(/fixtures\/simple\/src\/foo\.js$/);
  expect(dependencyOriginal.line).toBe(1);
});

test("hidden maps are emitted without a discovery comment", async () => {
  const { result, outDir } = await buildSimple("hidden");
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");

  await expect(
    fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  ).resolves.toContain('"sections"');
  expect(code).not.toContain("sourceMappingURL");
});

test("persists matching map artifacts and invalidates a missing map", async () => {
  const { cacheDir } = await buildSimple("external-cache");
  const mapArtifacts = (await fs.readdir(cacheDir, { recursive: true })).filter(
    (file) => file.endsWith(".js.map"),
  );
  expect(mapArtifacts.length).toBeGreaterThan(0);

  const missingMap = path.join(cacheDir, mapArtifacts[0]);
  await fs.rm(missingMap);
  await buildSimple("external-cache");
  await expect(fs.stat(missingMap)).resolves.toBeDefined();
});

test("rejects code-changing afterCombine hooks without an updated map", async () => {
  await expect(
    buildSimple("external-plugin", [
      {
        name: "mapless-after-combine",
        afterCombine: [
          ({ code }) => {
            "mapless-after-combine-v1";
            return `/* changed */\n${code}`;
          },
        ],
      },
    ]),
  ).rejects.toThrow("without returning an updated source map");
});

test("accepts generated beforeCombine parts and a mapped afterCombine change", async () => {
  const { result, outDir } = await buildSimple("external-combine-hooks", [
    {
      name: "mapped-combine-hooks",
      beforeCombine: [
        ({ plans }) => {
          "mapped-before-combine-v1";
          return plans.map((plan) => ({
            ...plan,
            orderedParts: [{ code: "/* before */" }, ...plan.orderedParts],
          }));
        },
      ],
      afterCombine: [
        ({ code, map }) => {
          "mapped-after-combine-v1";
          return {
            code: `/* after */\n${code}`,
            map: JSON.stringify({
              version: 3,
              sections: [
                {
                  offset: { line: 1, column: 0 },
                  map: JSON.parse(map),
                },
              ],
            }),
          };
        },
      ],
    },
  ]);
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
  const map = JSON.parse(
    await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  );
  const original = originalPositionFor(
    new AnyMap(map),
    generatedPosition(code, "const a33jpi1jb_value"),
  );

  expect(code).toContain("/* before */");
  expect(code).toContain("/* after */");
  expect(original.source).toMatch(/fixtures\/simple\/src\/index\.js$/);
  expect(original.line).toBe(4);
});

test("composes pre and post Babel maps into each cell map", async () => {
  const pluginModule = path.join(
    rootDir,
    "packages/bundler/test/plugins/source-map-transform-plugin.mjs",
  );
  const { result, outDir } = await buildSimple("external-transforms", [
    {
      __bundlerPluginRef: true,
      module: pluginModule,
    },
  ]);
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
  const map = JSON.parse(
    await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  );
  const position = generatedPosition(code, "const a33jpi1jb_value");
  const original = originalPositionFor(new AnyMap(map), position);

  expect(original.source).toMatch(/fixtures\/simple\/src\/index\.js$/);
  expect(original.line).toBe(4);
});

test("omits sourcesContent when configured", async () => {
  const { result, outDir } = await buildSimple("hidden-no-content", [], {
    sourceMap: { mode: "hidden", sourcesContent: false },
  });
  const [bundle] = result.bundles;
  const map = JSON.parse(
    await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  );

  expect(
    map.sections.every((section) => section.map.sourcesContent == null),
  ).toBe(true);
});

test("maps HMR installers and emits mapped eval patch records", async () => {
  const { result, outDir } = await buildSimple("external-hmr", [], {
    dev: { hmr: true, reactRefresh: false },
  });
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
  const map = JSON.parse(
    await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  );
  const position = generatedPosition(code, "a33jpi1jb_value =");
  const original = originalPositionFor(new AnyMap(map), position);
  const hmrBundle =
    result.manifest.metadata.hmr.bundles[`${bundle.envId}:${bundle.entryId}`];

  expect(original.source).toMatch(/fixtures\/simple\/src\/index\.js$/);
  expect(original.line).toBe(4);
  expect(hmrBundle.cells.some((cell) => cell.map)).toBe(true);
  expect(
    hmrBundle.cells.some((cell) =>
      cell.patchCode.includes("sourceMappingURL=data:application/json;base64"),
    ),
  ).toBe(true);
});

test("restores cell maps from the remote cache", async () => {
  const localDir = path.join(cacheRoot, "remote-local");
  const remoteDir = path.join(cacheRoot, "remote-store");
  const throwPlugin = path.join(
    rootDir,
    "packages/bundler/test/plugins/throw-on-env-plugin.mjs",
  );
  const cache = {
    local: { dir: localDir },
    remote: { kind: "file", dir: remoteDir, prefix: "source-map-test" },
  };
  const plugins = [{ __bundlerPluginRef: true, module: throwPlugin }];
  await fs.rm(localDir, { recursive: true, force: true });
  await fs.rm(remoteDir, { recursive: true, force: true });
  await buildSimple("external-remote", plugins, { cacheDir: localDir, cache });
  await fs.rm(localDir, { recursive: true, force: true });

  process.env.BUNDLER_THROW_TRANSFORM = "1";
  try {
    await buildSimple("external-remote", plugins, {
      cacheDir: localDir,
      cache,
    });
  } finally {
    delete process.env.BUNDLER_THROW_TRANSFORM;
  }

  const restoredMaps = (await fs.readdir(localDir, { recursive: true })).filter(
    (file) => file.endsWith(".js.map"),
  );
  expect(restoredMaps.length).toBeGreaterThan(0);
});

test("composes a load-hook input map through the cell and bundle maps", async () => {
  const projectDir = path.join(outRoot, "load-map-project");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  const entryPath = path.join(srcDir, "index.js");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(entryPath, "placeholder");
  const inputMap = JSON.stringify({
    version: 3,
    file: "index.js",
    sources: ["original.ts"],
    sourcesContent: ["export const value: number = 1;"],
    names: [],
    mappings: ";AAAA",
  });
  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: {
        browser: { conditions: ["default"], target: "browser" },
      },
      entries: [{ id: "load-map", path: entryPath }],
      outputs: {
        outDir,
        fileName: "load-map.[env].[hash].js",
        sourceMap: "external",
      },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 1,
      diagnostics: "human",
      plugins: [
        {
          name: "mapped-loader",
          load({ filePath }) {
            "mapped-loader-v1";
            if (filePath !== entryPath) {
              return undefined;
            }
            return {
              code: "\nexport const value = 1;",
              map: inputMap,
            };
          },
        },
      ],
    },
    [],
  );
  const [bundle] = result.bundles;
  const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
  const map = JSON.parse(
    await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
  );
  const declaration = code.match(/const [a-z0-9]+_value = 1/);
  expect(declaration).not.toBeNull();
  const original = originalPositionFor(
    new AnyMap(map),
    generatedPosition(code, declaration[0]),
  );

  expect(original.source).toMatch(/src\/original\.ts$/);
  expect(original.line).toBe(1);
});

test("offsets entry mappings past dynamic-import headers and maps dynamic bundles", async () => {
  const outDir = path.join(outRoot, "dynamic-import");
  const entryPath = path.join(fixturesDir, "dynamic-import/src/index.js");
  await fs.rm(outDir, { recursive: true, force: true });
  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: {
        browser: { conditions: ["default"], target: "browser" },
      },
      entries: [{ id: "dynamic-import", path: entryPath }],
      outputs: {
        outDir,
        fileName: "dynamic.[env].[hash].js",
        sourceMap: "external",
      },
      cacheDir: path.join(cacheRoot, "dynamic-import"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );
  expect(result.bundles).toHaveLength(2);

  const [entryBundle, dynamicBundle] = result.bundles;
  const entryCode = await fs.readFile(
    path.join(outDir, entryBundle.fileName),
    "utf8",
  );
  const entryMap = JSON.parse(
    await fs.readFile(path.join(outDir, entryBundle.mapFileName), "utf8"),
  );
  const entryDeclaration = entryCode.match(/async function [a-z0-9]+_loadFoo/);
  expect(entryCode).toMatch(/^const __IMPORT_/);
  expect(entryDeclaration).not.toBeNull();
  expect(
    originalPositionFor(
      new AnyMap(entryMap),
      generatedPosition(entryCode, entryDeclaration[0]),
    ),
  ).toMatchObject({
    source: expect.stringMatching(/dynamic-import\/src\/index\.js$/),
    line: 1,
  });

  const dynamicCode = await fs.readFile(
    path.join(outDir, dynamicBundle.fileName),
    "utf8",
  );
  const dynamicMap = JSON.parse(
    await fs.readFile(path.join(outDir, dynamicBundle.mapFileName), "utf8"),
  );
  const dynamicDeclaration = dynamicCode.match(/const [a-z0-9]+_foo = 42/);
  expect(dynamicDeclaration).not.toBeNull();
  expect(
    originalPositionFor(
      new AnyMap(dynamicMap),
      generatedPosition(dynamicCode, dynamicDeclaration[0]),
    ),
  ).toMatchObject({
    source: expect.stringMatching(/dynamic-import\/src\/foo\.js$/),
    line: 1,
  });
});

test("offsets entry and common maps past static bundle imports", async () => {
  const projectDir = path.join(outRoot, "static-imports");
  const srcDir = path.join(projectDir, "src");
  const outDir = path.join(projectDir, "dist");
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await fs.writeFile(
    path.join(srcDir, "shared.js"),
    "export const shared = 40;\n",
  );
  await fs.writeFile(
    path.join(srcDir, "a.js"),
    'import { shared } from "./shared.js";\nexport const a = shared + 1;\n',
  );
  await fs.writeFile(
    path.join(srcDir, "b.js"),
    'import { shared } from "./shared.js";\nexport const b = shared + 2;\n',
  );

  const { buildProject } = await import("../dist/builder.js");
  const result = await buildProject(
    {
      envs: { browser: { conditions: ["default"], target: "browser" } },
      entries: ["a", "b"].map((name) => ({
        id: name,
        path: path.join(srcDir, `${name}.js`),
      })),
      outputs: {
        outDir,
        fileName: "[entry].[env].[hash].js",
        sourceMap: "external",
      },
      cacheDir: path.join(projectDir, ".cache"),
      css: false,
      maxWorkers: 2,
      diagnostics: "human",
    },
    [],
  );

  for (const [entryName, expectedLine] of [
    ["a.js", 2],
    ["b.js", 2],
    ["bundler:common:browser", 1],
  ]) {
    const bundle = result.bundles.find((candidate) =>
      entryName.startsWith("bundler:")
        ? candidate.entryId === entryName
        : candidate.entryId.endsWith(entryName),
    );
    const code = await fs.readFile(path.join(outDir, bundle.fileName), "utf8");
    const map = JSON.parse(
      await fs.readFile(path.join(outDir, bundle.mapFileName), "utf8"),
    );
    const declaration = code.match(
      entryName === "a.js"
        ? /const [a-z0-9]+_a =/
        : entryName === "b.js"
          ? /const [a-z0-9]+_b =/
          : /const [a-z0-9]+_shared =/,
    );
    expect(declaration).not.toBeNull();
    expect(
      originalPositionFor(
        new AnyMap(map),
        generatedPosition(code, declaration[0]),
      ),
    ).toMatchObject({
      source: expect.stringMatching(
        entryName.startsWith("bundler:")
          ? /(?:^|\/)src\/shared\.js$/
          : new RegExp(`(?:^|/)src/${entryName.replace(".", "\\.")}$`),
      ),
      line: expectedLine,
    });
  }
});
