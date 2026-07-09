import {
  addClientPatchImports,
  classifyRscDevChange,
} from "../dist/dev/rsc-server.js";
import { createPatch } from "../dist/dev/server.js";

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
    records: ["cell"],
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
        records: ["cell"],
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
    records: ["cell"],
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
    records: ["cell"],
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
      patch: { type: "patch", records: [], changedBundles: [] },
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
    records: ["client cell", "island cell"],
    recordBundles: ["client:/app/src/client.jsx", "client:/app/src/island.jsx"],
    changedBundles: [
      "client:/app/src/client.jsx",
      "client:/app/src/island.jsx",
    ],
  };

  expect(addClientPatchImports(patch, build, "client", 7)).toEqual({
    ...patch,
    records: [
      "client cell",
      'Object.assign(globalThis.__BUNDLER_RSC_CHUNKS__ ??= {}, {"/app/src/island.jsx":"island.new.js"});',
    ],
    recordBundles: undefined,
    imports: [
      "/assets/island.new.js?hmr=island.new.js&rsc-id=%2Fapp%2Fsrc%2Fisland.jsx&v=7",
    ],
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
  previous.manifest.metadata = fakeHmrMetadata();
  next.manifest.metadata = fakeHmrMetadata();
  previous.manifest.assets = [
    styleAsset("client:/app/src/client.jsx", "client.old.css"),
  ];
  next.manifest.assets = [
    styleAsset("client:/app/src/client.jsx", "client.new.css"),
  ];

  expect(createPatch(previous, next)).toEqual({
    type: "patch",
    records: [],
    changedBundles: [],
    styles: [
      "/assets/client.new.css?hmr=client.new.css&key=client%3A%2Fapp%2Fsrc%2Fclient.jsx",
    ],
  });
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

function fakeHmrMetadata() {
  return {
    hmr: {
      bundles: {
        "client:/app/src/client.jsx": {
          envId: "client",
          entryId: "/app/src/client.jsx",
          reactRefresh: true,
          symbols: [],
          cells: [],
        },
      },
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

function bundle(envId, entryId, fileName, modules) {
  return { envId, entryId, fileName, modules };
}
