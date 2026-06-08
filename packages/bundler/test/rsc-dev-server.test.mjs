import { classifyRscDevChange } from "../dist/dev/rsc-server.js";

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

test("classifies shared client/server module edits as reloads", () => {
  const previous = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.old.js", [
      "/app/src/client.jsx",
      "/app/src/shared.js",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
      "/app/src/shared.js",
    ]),
  ]);
  const next = fakeBuild([
    bundle("client", "/app/src/client.jsx", "client.new.js", [
      "/app/src/client.jsx",
      "/app/src/shared.js",
    ]),
    bundle("rsc", "/app/src/server.jsx", "server.same.js", [
      "/app/src/server.jsx",
      "/app/src/shared.js",
    ]),
  ]);

  expect(
    classifyRscDevChange({
      previous,
      next,
      patch: {
        type: "patch",
        records: ["cell"],
        changedBundles: ["client:/app/src/client.jsx"],
      },
      clientEntryId: "client",
      serverEntryId: "server",
    }),
  ).toMatchObject({ type: "reload", reason: "shared-module-changed" });
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

function fakeBuild(bundles) {
  return {
    bundles: bundles.map(({ modules: _modules, ...bundle }) => bundle),
    manifest: {
      bundles,
      dynamicImports: {},
      emittedFiles: [],
      metadata: {},
    },
    diagnostics: [],
  };
}

function bundle(envId, entryId, fileName, modules) {
  return { envId, entryId, fileName, modules };
}
