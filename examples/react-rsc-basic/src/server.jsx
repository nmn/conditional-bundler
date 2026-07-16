import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createEnvironmentConditionEvaluator,
  transformConditionalBundle,
} from "@bundler/assets/runtime";
import React from "react";
import { renderToPipeableStream as renderHtmlToPipeableStream } from "react-dom/server";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import { renderToPipeableStream as renderRscToPipeableStream } from "react-server-dom-webpack/server.node";
import App from "./App.jsx";

const distDir = path.dirname(fileURLToPath(import.meta.url));
const evaluateCondition = createEnvironmentConditionEvaluator(process.env);
const transformedAssetCache = new Map();

export function createBasicServer(context = {}) {
  return http.createServer((request, response) => {
    void handleBasicRequest({
      ...context,
      request,
      response,
      url: new URL(request.url ?? "/", "http://localhost"),
    }).catch((error) => {
      response.statusCode = 500;
      response.end("Internal server error");
      console.error(error);
    });
  });
}

export function disposeBasicServer() {}

export async function handleBasicRequest({
  request: _request,
  response,
  url,
  clientBundle,
  dist = distDir,
} = {}) {
  const context = loadBasicContext({ dist, clientBundle });

  if (url.pathname === "/rsc") {
    response.setHeader("content-type", "text/x-component");
    renderRscPayload(context.clientManifest).pipe(response);
    return;
  }

  const staticAsset = resolveStaticAssetRequest(context.manifest, url.pathname);
  if (staticAsset) {
    const { fileName, asset } = staticAsset;
    response.setHeader(
      "content-type",
      asset?.contentType ?? "application/octet-stream",
    );
    response.end(await readStaticAsset(dist, fileName, asset));
    return;
  }

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(await renderHtml(url, context, dist));
}

async function readStaticAsset(dist, fileName, asset) {
  const contents = fs.readFileSync(
    path.join(dist, fileName),
    asset?.type === "script" ? "utf8" : undefined,
  );
  if (asset?.type !== "script") {
    return contents;
  }
  const transformed = await transformConditionalBundle(
    contents,
    evaluateCondition,
    {
      optionSet: asset.conditionNames
        ? { conditions: asset.conditionNames }
        : undefined,
      cache: {
        get(key) {
          return transformedAssetCache.get(`${fileName}:${key}`);
        },
        set(key, code) {
          transformedAssetCache.set(`${fileName}:${key}`, code);
        },
      },
    },
  );
  return transformed.code;
}

function loadBasicContext({ dist = distDir, clientBundle } = {}) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, "manifest.json"), "utf8"),
  );
  const resolvedClientBundle =
    clientBundle ??
    manifest.bundles.find(
      (bundle) =>
        bundle.envId === "client" &&
        (bundle.entryId.endsWith("runtime-client.js") ||
          bundle.entryId.endsWith("client.jsx")),
    );
  const clientManifest = JSON.parse(
    fs.readFileSync(path.join(dist, "rsc-client-manifest.json"), "utf8"),
  );

  if (!resolvedClientBundle) {
    throw new Error("Missing client bundle. Run the bundler build first.");
  }

  return {
    manifest,
    clientBundle: resolvedClientBundle,
    clientManifest,
    serverConsumerManifest: createServerConsumerManifest(clientManifest),
  };
}

if (!globalThis.__BUNDLER_RSC_DEV__) {
  const server = createBasicServer();
  const port = Number(process.env.PORT ?? 3100);
  server.listen(port, () => {
    console.log(`Basic RSC example running at http://localhost:${port}`);
  });
}

function renderRscPayload(clientManifest) {
  return renderRscToPipeableStream(<App />, clientManifest);
}

async function renderHtml(url, context, dist) {
  const initialRoute = await renderInitialRoute({ context, dist });
  const routePath = `${url.pathname}${url.search}`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>conditional-bundler RSC</title>
    <style>${style}</style>
    ${renderStyleLinks(context.manifest)}
  </head>
  <body>
    <div id="root">${initialRoute.markup}</div>
    <script id="__BUNDLER_RSC_CHUNKS__" type="application/json">${serializeJsonForScript(createRscChunkMap(context.clientManifest))}</script>
    <script id="__BUNDLER_RSC_DATA__" type="application/json" data-path="${escapeAttribute(routePath)}">${serializeJsonForScript(initialRoute.flight)}</script>
    <script type="module" src="/${context.clientBundle.fileName}"></script>
  </body>
</html>`;
}

function renderStyleLinks(manifest) {
  return (manifest.assets ?? [])
    .filter((asset) => asset.type === "style")
    .map(
      (asset) =>
        `<link rel="stylesheet" href="/${escapeAttribute(asset.fileName)}">`,
    )
    .join("\n    ");
}

function resolveStaticAssetRequest(manifest, pathname) {
  const requested = decodeURIComponent(pathname.replace(/^\/+/, ""));
  if (
    !requested ||
    requested.startsWith("/") ||
    requested.includes("\\") ||
    requested.split("/").includes("..")
  ) {
    return null;
  }
  const candidates = [requested];
  if (requested.startsWith("assets/")) {
    candidates.push(requested.slice("assets/".length));
  }
  for (const fileName of candidates) {
    const asset = manifest.assets?.find(
      (candidate) => candidate.fileName === fileName,
    );
    if (asset) {
      return { fileName, asset };
    }
  }
  return null;
}

async function renderInitialRoute({ context, dist }) {
  installNodeChunkLoader(dist, context.clientManifest);
  const flight = await renderRscPayloadToString(context.clientManifest);
  const model = await createFromNodeStream(
    Readable.from([flight]),
    context.serverConsumerManifest,
  );
  return {
    flight,
    markup: await renderReactMarkup(model),
  };
}

function renderRscPayloadToString(clientManifest) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let payload = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      payload += chunk;
    });
    output.on("end", () => resolve(payload));
    output.on("error", reject);
    renderRscPayload(clientManifest).pipe(output);
  });
}

function renderReactMarkup(model) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let markup = "";
    let didError = false;
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      markup += chunk;
    });
    output.on("end", () => {
      if (!didError) {
        resolve(markup);
      }
    });
    output.on("error", reject);

    const htmlStream = renderHtmlToPipeableStream(model, {
      onAllReady() {
        htmlStream.pipe(output);
      },
      onShellError(error) {
        didError = true;
        reject(error);
      },
      onError(error) {
        didError = true;
        reject(error);
      },
    });
  });
}

function createServerConsumerManifest(clientManifest) {
  const moduleMap = {};
  for (const record of Object.values(clientManifest)) {
    moduleMap[record.id] ??= {};
    moduleMap[record.id][record.name] = {
      id: record.id,
      chunks: record.chunks,
      name: record.name,
      async: record.async,
    };
  }
  return {
    moduleMap,
    moduleLoading: null,
    serverModuleMap: {},
  };
}

function installNodeChunkLoader(dist, clientManifest) {
  const cache = (globalThis.__BUNDLER_RSC_NODE_MODULE_CACHE__ ??= new Map());
  const chunkFiles = (globalThis.__BUNDLER_RSC_CHUNKS__ ??= {});
  Object.assign(chunkFiles, createRscChunkMap(clientManifest));
  globalThis.__webpack_require__ = (id) => {
    const module = cache.get(id);
    if (!module || typeof module.then === "function") {
      throw new Error(`RSC client chunk has not loaded: ${id}`);
    }
    return module;
  };
  globalThis.__webpack_require__.u = (chunkId) =>
    chunkFiles[chunkId] ?? chunkId;
  globalThis.__webpack_get_script_filename__ = (chunkId) =>
    globalThis.__webpack_require__.u(chunkId);
  globalThis.__webpack_chunk_load__ = (chunkId) => {
    const cached = cache.get(chunkId);
    if (cached) {
      return typeof cached.then === "function"
        ? cached
        : Promise.resolve(cached);
    }
    const fileName = globalThis.__webpack_require__.u(chunkId);
    const loading = import(pathToFileURL(path.join(dist, fileName)).href).then(
      (module) => {
        cache.set(chunkId, module);
        cache.set(fileName, module);
        return module;
      },
    );
    cache.set(chunkId, loading);
    cache.set(fileName, loading);
    return loading;
  };
}

function createRscChunkMap(clientManifest) {
  const chunks = {};
  for (const record of Object.values(clientManifest)) {
    if (record?.id && record?.fileName) {
      chunks[record.id] = record.fileName;
    }
  }
  return chunks;
}

function serializeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const style = `
html {
  background: #f6f2ea;
  color: #1f2524;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
}
body { margin: 0; }
button {
  border: 1px solid #1f2524;
  background: #d6ff62;
  color: #1f2524;
  cursor: pointer;
  font: inherit;
  padding: 0.75rem 1rem;
}
textarea {
  background: #fffdf8;
  border: 1px solid #1f2524;
  color: #1f2524;
  font: inherit;
  padding: 0.75rem;
  resize: vertical;
  width: 100%;
}
.shell {
  display: grid;
  gap: 2rem;
  margin: 0 auto;
  max-width: 920px;
  min-height: 100vh;
  padding: 12vh 24px;
}
.hero {
  border-left: 6px solid #e44d2e;
  padding-left: 24px;
}
.eyebrow,
.label {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
  text-transform: uppercase;
}
h1 {
  font-size: clamp(2.75rem, 9vw, 7rem);
  line-height: 0.92;
  margin: 0;
  max-width: 860px;
}
.lede {
  font-size: 1.25rem;
  max-width: 620px;
}
.client-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.client-panel {
  border: 1px solid #1f2524;
  display: grid;
  gap: 18px;
  min-height: 210px;
  padding: 20px;
}
.counter {
  align-items: center;
  grid-template-columns: 1fr auto;
  justify-content: space-between;
}
.counter strong {
  display: block;
  font-size: 4rem;
  line-height: 1;
}
.segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.segmented button {
  background: #fffdf8;
  min-width: 0;
}
.segmented button[aria-pressed="true"] {
  background: #1f2524;
  color: #f6f2ea;
}
.client-status {
  font-size: 1.1rem;
  margin: 0;
}
.draft-pad {
  align-content: start;
}
.draft-pad output {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  justify-self: end;
}
`;
