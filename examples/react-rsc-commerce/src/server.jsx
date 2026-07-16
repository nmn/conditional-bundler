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

export function createCommerceServer(context = {}) {
  return http.createServer((request, response) => {
    void handleCommerceRequest({
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

export function disposeCommerceServer() {}

export async function handleCommerceRequest({
  request: _request,
  response,
  url,
  clientBundle,
  dist = distDir,
} = {}) {
  const context = loadCommerceContext({ dist, clientBundle });

  if (url.pathname === "/rsc") {
    const routePath = url.searchParams.get("path") ?? "/";
    response.setHeader("content-type", "text/x-component");
    renderRscPayload(routePath, context.clientManifest).pipe(response);
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

function loadCommerceContext({ dist = distDir, clientBundle } = {}) {
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
  const server = createCommerceServer();
  const port = Number(process.env.PORT ?? 3200);
  server.listen(port, () => {
    console.log(`Monarch Goods running at http://localhost:${port}`);
  });
}

function renderRscPayload(routePath, clientManifest) {
  const routeUrl = new URL(routePath, "http://localhost");
  return renderRscToPipeableStream(
    <App
      path={`${routeUrl.pathname}${routeUrl.search}`}
      searchParams={Object.fromEntries(routeUrl.searchParams)}
    />,
    clientManifest,
  );
}

async function renderHtml(url, context, dist) {
  const initialRoute = await renderInitialRoute({
    routePath: `${url.pathname}${url.search}`,
    context,
    dist,
  });
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Monarch Goods</title>
    <style>${style}</style>
    ${renderStyleLinks(context.manifest)}
  </head>
  <body>
    <div id="root">${initialRoute.markup}</div>
    <script id="__BUNDLER_RSC_CHUNKS__" type="application/json">${serializeJsonForScript(createRscChunkMap(context.clientManifest, true))}</script>
    <script id="__BUNDLER_RSC_DATA__" type="application/json" data-path="${escapeAttribute(`${url.pathname}${url.search}`)}">${serializeJsonForScript(initialRoute.flight)}</script>
    <script type="module" src="/${context.clientBundle.fileName}"></script>
  </body>
</html>`;
}

function renderStyleLinks(manifest) {
  return (manifest.assets ?? [])
    .filter((asset) => asset.type === "style")
    .map(
      (asset) =>
        `<link rel="stylesheet" href="/${escapeAttribute(asset.fileName)}" data-bundler-style="${escapeAttribute(asset.bundleKey ?? asset.fileName)}">`,
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

async function renderInitialRoute({ routePath, context, dist }) {
  installNodeChunkLoader(dist, context.clientManifest);
  const flight = await renderRscPayloadToString(
    routePath,
    context.clientManifest,
  );
  const model = await createFromNodeStream(
    Readable.from([flight]),
    context.serverConsumerManifest,
  );
  return {
    flight,
    markup: await renderReactMarkup(model),
  };
}

function renderRscPayloadToString(routePath, clientManifest) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let payload = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      payload += chunk;
    });
    output.on("end", () => resolve(payload));
    output.on("error", reject);
    renderRscPayload(routePath, clientManifest).pipe(output);
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

function createRscChunkMap(clientManifest, browser = false) {
  const chunks = {};
  for (const record of Object.values(clientManifest)) {
    if (record?.id && record?.fileName) {
      chunks[record.id] = browser
        ? (record.url ?? record.fileName)
        : record.fileName;
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
:root {
  color: #1b1915;
  background: #f5eee1;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
  --ink: #1b1915;
  --paper: #f5eee1;
  --porcelain: #fffaf0;
  --line: #2f2a22;
  --acid: #d7ff45;
  --oxide: #b64b2f;
  --sage: #73856e;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
}
a { color: inherit; text-decoration: none; }
button {
  border: 1px solid var(--line);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}
.app-shell {
  margin: 0 auto;
  max-width: 1480px;
  min-height: 100vh;
  padding: 24px clamp(16px, 4vw, 56px) 64px;
}
.store-header {
  align-items: center;
  border-bottom: 2px solid var(--line);
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(260px, 1fr) auto;
  margin-bottom: 30px;
  padding-bottom: 18px;
}
.brand {
  align-items: center;
  display: inline-flex;
  gap: 14px;
}
.brand-mark {
  align-items: center;
  background: var(--ink);
  color: var(--paper);
  display: inline-flex;
  font-size: 1.4rem;
  height: 48px;
  justify-content: center;
  width: 48px;
}
.brand strong {
  display: block;
  font-size: 1.3rem;
}
.brand small,
.eyebrow,
.product-card p,
.client-rail,
.category-strip,
.detail-metrics,
.path-chip {
  font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
  letter-spacing: 0;
  text-transform: uppercase;
}
.brand small {
  display: block;
  font-size: 0.75rem;
}
.nav-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: end;
}
.nav-strip a,
.category-strip a,
.search-chip,
.path-chip {
  border: 1px solid var(--line);
  padding: 9px 12px;
}
.nav-strip a[aria-current="page"],
.category-strip a[aria-current="page"] {
  background: var(--acid);
}
.client-rail {
  align-items: center;
  bottom: 18px;
  display: flex;
  gap: 8px;
  position: fixed;
  right: 18px;
  z-index: 10;
}
.cart-chip {
  align-items: center;
  background: var(--ink);
  color: var(--paper);
  display: inline-flex;
  gap: 9px;
  padding: 10px 14px;
}
.cart-chip span {
  background: var(--acid);
  color: var(--ink);
  display: inline-grid;
  min-width: 24px;
  place-items: center;
}
.hero-commerce {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 340px);
  min-height: 52vh;
}
.hero-commerce h1,
.route-heading h1,
.detail-copy h1,
.journal-layout h1 {
  font-size: clamp(3rem, 8vw, 8.5rem);
  letter-spacing: 0;
  line-height: 0.86;
  margin: 0;
  max-width: 980px;
}
.hero-commerce aside,
.process-card,
.account-grid article,
.support-grid article,
.journal-layout aside,
.empty-cart {
  border: 2px solid var(--line);
  background: var(--porcelain);
  padding: 22px;
}
.hero-commerce aside > strong {
  display: block;
  font-size: 6rem;
  line-height: 0.9;
}
.home-counter {
  border-top: 1px solid var(--line);
  display: grid;
  gap: 10px;
  margin-top: 20px;
  padding-top: 18px;
}
.home-counter > span {
  font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
  text-transform: uppercase;
}
.home-counter > strong {
  display: block;
  font-size: 3rem;
  line-height: 0.9;
}
.home-counter div {
  display: grid;
  gap: 6px;
  grid-template-columns: 44px minmax(76px, 1fr) 44px;
}
.home-counter button {
  background: var(--porcelain);
  min-width: 0;
  padding: 9px 8px;
}
.home-counter button:hover {
  background: var(--acid);
}
.home-client-tools {
  border-bottom: 2px solid var(--line);
  border-top: 2px solid var(--line);
  display: grid;
  gap: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 30px 0;
}
.home-tool {
  align-content: start;
  display: grid;
  gap: 14px;
  min-height: 170px;
  padding: 20px;
}
.home-tool + .home-tool {
  border-left: 1px solid var(--line);
}
.home-tool p,
.home-tool output {
  margin: 0;
}
.home-tool output {
  font-size: 1.15rem;
}
.tool-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tool-segments button {
  background: var(--porcelain);
  padding: 8px 10px;
}
.tool-segments button[aria-pressed="true"] {
  background: var(--acid);
}
.delivery-estimator select {
  appearance: none;
  background: var(--porcelain);
  border: 1px solid var(--line);
  color: var(--ink);
  font: inherit;
  padding: 10px 12px;
  width: 100%;
}
.product-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.product-card {
  background: var(--porcelain);
  border: 2px solid var(--line);
  display: grid;
  gap: 16px;
  padding: 14px;
}
.product-visual {
  aspect-ratio: 1.15;
  border: 1px solid var(--line);
  display: grid;
  overflow: hidden;
  place-items: center;
  position: relative;
}
.product-visual span {
  border-radius: 999px;
  display: block;
  filter: saturate(0.92);
  height: 58%;
  width: 58%;
}
.product-visual em {
  background: var(--acid);
  bottom: 10px;
  font-style: normal;
  left: 10px;
  padding: 6px 9px;
  position: absolute;
}
.product-card h2 {
  font-size: 1.45rem;
  line-height: 1;
  margin: 4px 0 8px;
}
.purchase-panel {
  display: grid;
  gap: 8px;
}
.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.segmented button {
  background: transparent;
  min-width: 0;
  padding: 8px 6px;
}
.segmented .active,
.primary-action {
  background: var(--ink);
  color: var(--paper);
}
.primary-action {
  padding: 12px 14px;
}
.purchase-panel p {
  margin: 0;
  text-transform: none;
}
.catalog-layout,
.route-stack,
.checkout-grid,
.account-grid,
.support-grid {
  display: grid;
  gap: 22px;
}
.category-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.product-detail {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr) minmax(220px, 0.5fr);
}
.detail-art {
  align-items: end;
  aspect-ratio: 0.78;
  background:
    linear-gradient(135deg, transparent 0 48%, rgba(0,0,0,0.08) 48% 52%, transparent 52%),
    var(--product-color);
  border: 2px solid var(--line);
  display: flex;
  padding: 20px;
}
.detail-art span {
  background: var(--porcelain);
  padding: 10px 12px;
}
.lede {
  font-size: 1.3rem;
  line-height: 1.45;
}
.detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 22px 0;
}
.detail-metrics span,
.merch-note {
  border: 1px solid var(--line);
  padding: 10px 12px;
}
.related-panel {
  border-left: 2px solid var(--line);
  display: grid;
  gap: 12px;
  align-content: start;
  padding-left: 18px;
}
.related-panel a,
.search-list a,
.cart-table article,
.order-list article {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: grid;
  gap: 14px;
  grid-template-columns: auto 1fr auto;
  padding: 14px 0;
}
.related-panel span,
.search-list span,
.product-swatch {
  display: block;
  height: 34px;
  width: 34px;
}
.checkout-grid,
.account-grid,
.support-grid {
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}
.route-heading {
  grid-column: 1 / -1;
}
.process-card span,
.account-grid span {
  color: var(--oxide);
}
.order-list,
.cart-table,
.search-list {
  display: grid;
  gap: 8px;
}
.cart-table footer {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding-top: 18px;
}
.cart-table button {
  background: transparent;
  padding: 8px 10px;
}
.journal-layout {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) 280px;
}
.journal-layout article p {
  font-size: 1.4rem;
  line-height: 1.5;
  max-width: 760px;
}
.route-loading {
  border: 2px solid var(--line);
  margin: 12vh auto;
  max-width: 340px;
  padding: 24px;
  text-align: center;
}
@media (max-width: 820px) {
  .store-header,
  .hero-commerce,
  .home-client-tools,
  .product-detail,
  .journal-layout {
    grid-template-columns: 1fr;
  }
  .nav-strip {
    justify-content: start;
  }
  .home-tool + .home-tool {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .client-rail {
    left: 12px;
    right: 12px;
  }
  .path-chip {
    display: none;
  }
}
`;
