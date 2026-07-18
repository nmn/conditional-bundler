import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  addClientPatchImports,
  classifyRscDevChange,
  syncChangedRscNodeModules,
} from "../dist/dev/rsc-server.js";
import { resolveConditionalPatch } from "../dist/dev/conditional-assets.js";
import {
  createPatch,
  createRebuildScheduler,
  HmrUpdateStore,
} from "../dist/dev/server.js";

test("resolves conditional HMR records from environment values", async () => {
  const previous = process.env.DEV;
  const record = [
    '/////##CONDITION_START##"DEV"',
    'console.log("development");',
    "/////##CONDITION_END##",
    '/////##CONDITION_START##{"NOT":"DEV"}',
    'console.log("production");',
    "/////##CONDITION_END##",
  ].join("\n");

  try {
    delete process.env.DEV;
    const production = await resolveConditionalPatch({ records: [record] });
    expect(production.records[0]).toHaveLength(record.length);
    expect(production.records[0]).not.toContain("CONDITION_START");
    expect(production.records[0]).not.toContain("development");
    expect(production.records[0]).toContain("production");

    process.env.DEV = "1";
    const development = await resolveConditionalPatch({ records: [record] });
    expect(development.records[0]).toHaveLength(record.length);
    expect(development.records[0]).not.toContain("CONDITION_START");
    expect(development.records[0]).toContain("development");
    expect(development.records[0]).not.toContain("production");
  } finally {
    if (previous === undefined) {
      delete process.env.DEV;
    } else {
      process.env.DEV = previous;
    }
  }
});

test("publishes opaque HMR update resources without putting code in messages", async () => {
  const store = new HmrUpdateStore();
  const patch = {
    type: "patch",
    updates: [update("client:/app/src/client.jsx")],
    changedBundles: ["client:/app/src/client.jsx"],
  };

  const message = await store.publish(patch);
  expect(message.updates).toEqual([
    {
      bundleKey: "client:/app/src/client.jsx",
      url: expect.stringMatching(
        /^\/__bundler_hmr_updates\/1\/[a-f0-9]{24}\.js$/,
      ),
    },
  ]);
  expect(JSON.stringify(message)).not.toContain("void 0");
  expect(message.updates[0].url).not.toContain("app/src");
  expect(store.read(message.updates[0].url)).toContain(
    "__BUNDLER_HMR__.register",
  );
  expect(store.read("/__bundler_hmr_updates/1/missing.js")).toBeNull();
});

test("classifies pure client bundle edits as patchable", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.old.js", [
      "/app/src/client.jsx",
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
    ]),
  ]);
  const patch = {
    type: "patch",
    updates: [update("client:/app/src/client.jsx")],
    changedBundles: ["client:/app/src/client.jsx"],
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("classifies RSC bundle edits as reloads", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.same.js", [
      "/app/src/client.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.old.js", [
      "/app/src/server.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.same.js", [
      "/app/src/client.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.new.js", [
      "/app/src/server.jsx",
    ]),
  ]);

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch: {
        type: "patch",
        updates: [update("rsc:/app/src/server.jsx")],
        changedBundles: ["rsc:/app/src/server.jsx"],
      },
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toMatchObject({ type: "reload", reason: "non-client-bundle-changed" });
});

test("keeps client-only island edits patchable when client entry output changes", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.old.js", [
      "/app/src/client.jsx",
    ]),
    bundle("client", "/app/src/island.jsx", "island.old.js", [
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
    ]),
    bundle("client", "/app/src/island.jsx", "island.new.js", [
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
    ]),
  ]);
  const patch = {
    type: "patch",
    updates: [update("client:/app/src/island.jsx")],
    changedBundles: ["client:/app/src/island.jsx"],
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("keeps client reference edits patchable when the module has an RSC stub", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.old.js", [
      "/app/src/client.jsx",
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
      "/app/src/island.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
      "/app/src/island.jsx",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
      "/app/src/island.jsx",
    ]),
  ]);
  const patch = {
    type: "patch",
    updates: [update("client:/app/src/client.jsx")],
    changedBundles: ["client:/app/src/client.jsx"],
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("ignores server filename churn caused only by changed style resources", () => {
  const clientEntryId = "/app/src/island.jsx";
  const previous = fakeBuild([
    bundle("client", clientEntryId, "island.old.js", [clientEntryId]),
    bundle(
      "rsc",
      "/app/src/server.jsx",
      "server.resource-old.js",
      ["/app/src/server.jsx"],
      "same-server-runtime",
    ),
  ]);
  const next = fakeBuild([
    bundle("client", clientEntryId, "island.new.js", [clientEntryId]),
    bundle(
      "rsc",
      "/app/src/server.jsx",
      "server.resource-new.js",
      ["/app/src/server.jsx"],
      "same-server-runtime",
    ),
  ]);
  const patch = {
    type: "patch",
    updates: [update(`client:${clientEntryId}`)],
    changedBundles: [`client:${clientEntryId}`],
    styles: ["/assets/tailwind.new.css"],
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "/app/src/island.jsx",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("ignores ordinary build manifest churn and keeps client updates granular", () => {
  const entryId = "/app/src/island.jsx";
  const key = `client:${entryId}`;
  const previous = fakeBuild([
    bundle("client", entryId, "island.old.js", [entryId]),
  ]);
  const next = fakeBuild([
    bundle("client", entryId, "island.new.js", [entryId]),
  ]);
  previous.hmr = hmrState(key, "old-hash");
  next.hmr = hmrState(key, "new-hash");
  previous.manifest.emittedFiles = [
    manifestAsset("manifest.json", "old-manifest"),
  ];
  next.manifest.emittedFiles = [manifestAsset("manifest.json", "new-manifest")];

  expect(createPatch(previous, next)).toBeNull();
  expect(
    createPatch(previous, next, { ignoreManifestResources: true }),
  ).toEqual({
    type: "patch",
    updates: [
      {
        bundleKey: key,
        cell: expect.objectContaining({ id: `${key}:cell`, hash: "new-hash" }),
      },
    ],
    changedBundles: [key],
    styles: [],
  });
});

test("classifies output-only changes as reloads", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.old.js", [
      "/app/src/client.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
    ]),
  ]);

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch: { type: "patch", updates: [], changedBundles: [] },
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toMatchObject({
    type: "reload",
    reason: "bundle-output-changed-without-patch",
  });
});

test("adds dynamic imports for changed client chunks but not the client entry", () => {
  const build = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
    ]),
    bundle("client", "/app/src/island.jsx", "island.new.js", [
      "/app/src/island.jsx",
    ]),
  ]);
  build.manifest.metadata.rsc = {
    clientReferenceBundles: {
      "/src/island.jsx": {
        client: "client:/app/src/island.jsx",
      },
    },
  };
  const patch = {
    type: "patch",
    updates: [
      update("client:/app/src/client.jsx"),
      update("client:/app/src/island.jsx"),
    ],
    changedBundles: [
      "client:/app/src/client.jsx",
      "client:/app/src/island.jsx",
    ],
  };

  expect(addClientPatchImports(patch, build, "client", 7)).toEqual({
    ...patch,
    updates: [patch.updates[0]],
    imports: [
      "/island.new.js?hmr=island.new.js&rsc-id=%2Fsrc%2Fisland.jsx&v=7",
    ],
    rscModules: ["/src/island.jsx"],
  });
});

test("updates every portable client reference exposed by a shared bundle", () => {
  const build = fakeBuild([
    bundle("client", "/app/src/islands.jsx", "islands.new.js", [
      "/app/src/a.jsx",
      "/app/src/b.jsx",
    ]),
  ]);
  build.manifest.metadata.rsc = {
    clientReferenceBundles: {
      "/src/a.jsx": {
        client: "client:/app/src/islands.jsx",
      },
      "/src/b.jsx": {
        client: "client:/app/src/islands.jsx",
      },
    },
  };
  const key = "client:/app/src/islands.jsx";
  const patch = {
    type: "patch",
    updates: [update(key)],
    changedBundles: [key],
  };

  expect(addClientPatchImports(patch, build, "client", 2)).toEqual({
    ...patch,
    updates: [],
    imports: [
      "/islands.new.js?hmr=islands.new.js&rsc-id=%2Fsrc%2Fa.jsx&rsc-id=%2Fsrc%2Fb.jsx&v=2",
    ],
    rscModules: ["/src/a.jsx", "/src/b.jsx"],
  });
});

test("creates style-only HMR patches for changed CSS assets", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.same.js", [
      "/app/src/client.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle(
      "client",
      "/app/src/client.jsx",
      "client.same.js",
      ["/app/src/client.jsx"],
      "client-runtime-after-style-change",
    ),
  ]);
  previous.hmr = fakeHmrState();
  next.hmr = fakeHmrState();
  previous.manifest.assets = [
    styleAsset("client:/app/src/client.jsx", "client.old.css"),
  ];
  next.manifest.assets = [
    styleAsset("client:/app/src/client.jsx", "client.new.css"),
  ];

  const patch = createPatch(previous, next);
  expect(patch).toEqual({
    type: "patch",
    updates: [],
    changedBundles: [],
    styles: [
      "/assets/client.new.css?hmr=client.new.css&key=client%3A%2Fapp%2Fsrc%2Fclient.jsx",
    ],
  });
  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("refreshes RSC when server transform metadata changes without a code cell", () => {
  const previous = fakeBuild([
    bundle("server::react.server", "/app/src/server.jsx", "server.js", [
      "/app/src/server.jsx",
    ]),
    bundle(
      "client::react.client",
      "/app/runtime-client.js",
      "client.js",
      ["/app/runtime-client.js"],
      "client-runtime",
      "client",
    ),
  ]);
  const next = structuredClone(previous);
  for (const build of [previous, next]) {
    const server = build.bundles.find((item) =>
      item.entryId.endsWith("server.jsx"),
    );
    server.environmentId = "react.server";
    server.targetId = "server";
  }
  previous.hmr = {
    bundles: {},
    moduleMetadata: {
      "server::react.server:/app/src/server.jsx": {
        environmentId: "react.server",
        targetId: "server",
        filePath: "/app/src/App.jsx",
        hash: "old-stylex-rules",
      },
    },
  };
  next.hmr = {
    bundles: {},
    moduleMetadata: {
      "server::react.server:/app/src/server.jsx": {
        environmentId: "react.server",
        targetId: "server",
        filePath: "/app/src/App.jsx",
        hash: "new-stylex-rules",
      },
    },
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch: {
        type: "patch",
        updates: [],
        changedBundles: [],
        styles: ["/assets/stylex.new.css"],
      },
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({
    type: "reload",
    reason: "server-transform-metadata-changed",
  });
});

test("finds the client runtime by target after arbitrary entry ids are removed", () => {
  const previous = fakeBuild([
    bundle(
      "client::react.client",
      "/app/runtime-client.js",
      "runtime.same.js",
      ["/app/runtime-client.js"],
      "runtime-before-style-change",
      "client",
    ),
  ]);
  const next = fakeBuild([
    bundle(
      "client::react.client",
      "/app/runtime-client.js",
      "runtime.same.js",
      ["/app/runtime-client.js"],
      "runtime-after-style-change",
      "client",
    ),
  ]);
  const patch = {
    type: "patch",
    updates: [],
    changedBundles: [],
    styles: ["/assets/app.new.css"],
  };

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch,
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toEqual({ type: "patch", patch });
});

test("serializes rebuilds and coalesces changes received during a build", async () => {
  let active = 0;
  let maximumActive = 0;
  let runs = 0;
  let releaseFirst;
  const firstRun = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const scheduler = createRebuildScheduler(async () => {
    runs += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (runs === 1) {
      await firstRun;
    }
    active -= 1;
  }, 0);

  scheduler.notify();
  await waitFor(() => runs === 1);
  scheduler.notify();
  scheduler.notify();
  releaseFirst();
  await waitFor(() => runs === 2 && active === 0);
  scheduler.close();

  expect(runs).toBe(2);
  expect(maximumActive).toBe(1);
});

test("replaces changed modules in the server-side RSC chunk cache", async () => {
  const previousImplementations = globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__;
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "bundler-rsc-hmr-"));
  try {
    globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__ = new Map([
      ["/src/island.jsx#marker", { status: "fulfilled", value: "stale" }],
      [
        "/src/unchanged.jsx#marker",
        { status: "fulfilled", value: "unchanged" },
      ],
    ]);
    await fs.writeFile(
      path.join(outDir, "island.new.mjs"),
      'export const marker = "new";',
    );
    const previous = fakeBuild([
      bundle(
        "server::react.client",
        "/app/src/island.jsx",
        "island.old.mjs",
        ["/app/src/island.jsx"],
        "island.old.mjs",
        "server",
      ),
    ]);
    const next = fakeBuild([
      bundle(
        "server::react.client",
        "/app/src/island.jsx",
        "island.new.mjs",
        ["/app/src/island.jsx"],
        "island.new.mjs",
        "server",
      ),
    ]);
    next.manifest.metadata.rsc = {
      clientReferenceBundles: {
        "/src/island.jsx": {
          server: "server::react.client:/app/src/island.jsx",
        },
      },
    };

    await syncChangedRscNodeModules(
      {
        targets: { server: { platform: "node" } },
        environments: { "react.client": {} },
        entries: [],
        outputs: { outDir },
      },
      previous,
      next,
      1,
    );

    expect(
      globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__.get("/src/island.jsx#marker")
        .value,
    ).toBe("new");
    expect(
      globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__.get(
        "/src/unchanged.jsx#marker",
      ).value,
    ).toBe("unchanged");
  } finally {
    globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__ = previousImplementations;
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

function fakeBuild(bundles) {
  return {
    bundles,
    manifest: {
      bundles,
      dynamicImports: {},
      emittedFiles: [],
      metadata: {},
    },
    diagnostics: [],
  };
}

function fakeHmrState() {
  return {
    bundles: {
      "client:/app/src/client.jsx": {
        envId: "client",
        entryId: "/app/src/client.jsx",
        reactRefresh: true,
        symbols: [],
        cells: [],
      },
    },
  };
}

function hmrState(bundleKey, hash) {
  return {
    bundles: {
      [bundleKey]: {
        envId: "client",
        entryId: bundleKey.slice("client:".length),
        reactRefresh: true,
        symbols: ["island_Component"],
        cells: [
          {
            id: `${bundleKey}:cell`,
            fileId: `${bundleKey}:file`,
            symbols: ["island_Component"],
            deps: [],
            hash,
            code: "island_Component = function Component() {};",
          },
        ],
      },
    },
  };
}

function update(bundleKey) {
  return {
    bundleKey,
    cell: {
      id: `${bundleKey}:cell`,
      fileId: `${bundleKey}:file`,
      symbols: [],
      deps: [],
      hash: "hash",
      code: "void 0;",
    },
  };
}

function styleAsset(bundleKey, fileName) {
  return {
    fileName,
    type: "style",
    contentType: "text/css; charset=utf-8",
    bundleKey,
  };
}

function manifestAsset(fileName, contentHash) {
  return {
    fileName,
    type: "manifest",
    contentType: "application/json; charset=utf-8",
    contentHash,
  };
}

function bundle(
  envId,
  entryId,
  fileName,
  modules,
  runtimeHash = fileName,
  targetId = envId === "client" ? "client" : "server",
) {
  return {
    id: `${envId}:${entryId}`,
    scopeIds: [envId],
    environmentIds: [envId],
    targetIds: [targetId],
    entrypoints: [{ envId, entryId, exportMode: "dynamic", targetId }],
    targetId,
    envId,
    entryId,
    fileName,
    runtimeHash,
    exportMode: "dynamic",
    modules,
  };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for test condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
