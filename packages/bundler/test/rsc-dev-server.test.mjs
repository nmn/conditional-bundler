import {
  addClientPatchImports,
  classifyRscDevChange,
} from "../dist/dev/rsc-server.js";
import { resolveConditionalPatch } from "../dist/dev/conditional-assets.js";
import { createPatch, HmrUpdateStore } from "../dist/dev/server.js";

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

test("ignores generated RSC manifest churn and keeps client updates granular", () => {
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
    manifestAsset("rsc-client-manifest.json", "old-manifest"),
  ];
  next.manifest.emittedFiles = [
    manifestAsset("rsc-client-manifest.json", "new-manifest"),
  ];

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
      "/assets/island.new.js?hmr=island.new.js&rsc-id=%2Fapp%2Fsrc%2Fisland.jsx&v=7",
    ],
    rscChunks: { "/app/src/island.jsx": "island.new.js" },
  });
});

test("creates style-only HMR patches for changed CSS assets", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.same.js", [
      "/app/src/client.jsx",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.same.js", [
      "/app/src/client.jsx",
    ]),
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

function bundle(envId, entryId, fileName, modules) {
  return { envId, entryId, fileName, modules };
}
