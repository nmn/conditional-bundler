import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readConditionalAssetRequest,
  resolveRequestOptions,
} from "../dist/server.js";

const manifest = {
  assets: [
    {
      fileName: "app.js",
      type: "script",
      contentType: "text/javascript; charset=utf-8",
      bundleKey: "browser-app",
    },
    {
      fileName: "app.js.map",
      type: "source-map",
      contentType: "application/json; charset=utf-8",
    },
  ],
  bundles: [
    {
      id: "browser-app",
      fileName: "app.js",
      platform: "browser",
    },
  ],
  metadata: {
    conditions: {
      global: ["isChrome", "isFirefox", "isSafari"],
    },
  },
};

test("serves only decoded script variants and preserves generated positions", async () => {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), "bundler-assets-"));
  const source = [
    'import "./shared.id-x.js";',
    '/////##CONDITION_START##"isChrome"',
    'const browser = "chrome";',
    "/////##CONDITION_END##",
    '/////##CONDITION_START##"isFirefox"',
    'const browser = "firefox";',
    "/////##CONDITION_END##",
    '/////##CONDITION_START##"isSafari"',
    'const browser = "safari";',
    "/////##CONDITION_END##",
    '/////##CONDITION_START##{"NOT":{"OR":["isChrome","isFirefox","isSafari"]}}',
    'const browser = "unknown";',
    "/////##CONDITION_END##",
  ].join("\n");
  await fs.writeFile(path.join(dist, "app.js"), source);
  await fs.writeFile(
    path.join(dist, "app.js.map"),
    JSON.stringify({ version: 3, file: "app.js", mappings: "" }),
  );

  try {
    for (const [id, selected] of [
      ["1", "chrome"],
      ["2", "firefox"],
      ["4", "safari"],
      ["0", "unknown"],
    ]) {
      const response = await readConditionalAssetRequest({
        dist,
        manifest,
        pathname: `/app.id-${id}.js`,
      });
      expect(response).toMatchObject({ handled: true, statusCode: 200 });
      expect(response.body).toHaveLength(source.length);
      expect(response.body).toContain(`const browser = "${selected}";`);
      expect(response.body).toContain(`"./shared.id-${id}.js"`);
      expect(response.body).not.toContain("CONDITION_");
    }

    await expect(
      readConditionalAssetRequest({
        dist,
        manifest,
        pathname: "/app.js",
      }),
    ).resolves.toMatchObject({ handled: true, statusCode: 404 });
    await expect(
      readConditionalAssetRequest({
        dist,
        manifest,
        pathname: "/app.id-8.js",
      }),
    ).resolves.toMatchObject({ handled: true, statusCode: 404 });
    await expect(
      readConditionalAssetRequest({
        dist,
        manifest,
        pathname: "/app.js.map",
      }),
    ).resolves.toMatchObject({ handled: true, statusCode: 200 });
  } finally {
    await fs.rm(dist, { recursive: true, force: true });
  }
});

test("request option resolution uses the global sorted condition list", async () => {
  await expect(
    resolveRequestOptions(
      manifest,
      "Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15",
    ),
  ).resolves.toEqual({
    optionSet: {
      conditions: ["isChrome", "isFirefox", "isSafari"],
    },
    resolved: {
      key: "4",
      values: {
        isChrome: false,
        isFirefox: false,
        isSafari: true,
      },
    },
  });
});
