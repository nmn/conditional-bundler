import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToPipeableStream as renderHtmlToPipeableStream } from "react-dom/server";
import { createFromNodeStream } from "react-server-dom-webpack/client.node";
import { renderToPipeableStream as renderRscToPipeableStream } from "react-server-dom-webpack/server.node";

const defaultDistDir = path.dirname(fileURLToPath(import.meta.url));

export function createRscExampleServer(options) {
  return http.createServer((request, response) => {
    void handleRscExampleRequest({
      ...options,
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

export async function handleRscExampleRequest({
  AppComponent,
  title,
  request: _request,
  response,
  url,
  clientBundle,
  dist = defaultDistDir,
}) {
  if (!AppComponent) {
    throw new Error("An AppComponent is required.");
  }
  const context = loadContext({ dist, clientBundle });
  if (url.pathname === "/rsc") {
    response.setHeader("content-type", "text/x-component");
    renderRscPayload(
      url.searchParams.get("path") ?? "/",
      context.clientManifest,
      AppComponent,
    ).pipe(response);
    return;
  }

  const staticAsset = resolveStaticAssetRequest(context.manifest, url.pathname);
  if (staticAsset) {
    response.setHeader(
      "content-type",
      staticAsset.contentType ?? "application/octet-stream",
    );
    response.end(fs.readFileSync(path.join(dist, staticAsset.fileName)));
    return;
  }

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(
    await renderHtml(url, context, dist, AppComponent, title ?? "RSC Example"),
  );
}

function loadContext({ dist, clientBundle }) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, "manifest.json"), "utf8"),
  );
  const logicalEntry = Object.entries(manifest.entrypoints ?? {}).find(
    ([key]) => key.startsWith("client:") && key.endsWith("runtime-client.js"),
  )?.[1];
  const resolvedClientBundle =
    clientBundle ??
    (logicalEntry
      ? manifest.bundles.find((bundle) => bundle.id === logicalEntry.bundleId)
      : manifest.bundles.find(
          (bundle) =>
            (bundle.environmentIds ?? [bundle.envId]).includes("client") &&
            bundle.entryId.endsWith("runtime-client.js"),
        ));
  if (!resolvedClientBundle) {
    throw new Error("Missing client runtime bundle.");
  }
  const clientManifest = JSON.parse(
    fs.readFileSync(path.join(dist, "rsc-client-manifest.json"), "utf8"),
  );
  const serverRoot = manifest.bundles
    .flatMap((bundle) => bundle.entrypoints ?? [])
    .find(
      (entrypoint) =>
        entrypoint.envId === "rsc" && entrypoint.exportMode === "entry",
    );
  const serverEntrypoint = serverRoot
    ? manifest.entrypoints?.[`rsc:${serverRoot.entryId}`]
    : undefined;
  const clientEntrypoint =
    logicalEntry ??
    Object.values(manifest.entrypoints ?? {}).find(
      (entrypoint) => entrypoint.bundleId === resolvedClientBundle.id,
    );
  return {
    manifest,
    clientBundle: resolvedClientBundle,
    clientEntrypoint,
    documentStyles: Array.from(
      new Set([
        ...(serverEntrypoint?.styles ?? []),
        ...(clientEntrypoint?.styles ?? []),
      ]),
    ),
    clientManifest,
    serverConsumerManifest: createServerConsumerManifest(clientManifest),
  };
}

function renderRscPayload(routePath, clientManifest, AppComponent) {
  const routeUrl = new URL(routePath, "http://localhost");
  return renderRscToPipeableStream(
    <AppComponent
      path={`${routeUrl.pathname}${routeUrl.search}`}
      searchParams={Object.fromEntries(routeUrl.searchParams)}
    />,
    clientManifest,
  );
}

async function renderHtml(url, context, dist, AppComponent, title) {
  const routePath = `${url.pathname}${url.search}`;
  const initialRoute = await renderInitialRoute({
    routePath,
    context,
    dist,
    AppComponent,
  });
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeAttribute(title)}</title>
    ${renderStyleLinks(context.documentStyles, context.manifest)}
  </head>
  <body>
    <div id="root">${initialRoute.markup}</div>
    <script id="__BUNDLER_RSC_CHUNKS__" type="application/json">${serializeJsonForScript(createRscChunkMap(context.clientManifest, true))}</script>
    <script id="__BUNDLER_RSC_DATA__" type="application/json" data-path="${escapeAttribute(routePath)}">${serializeJsonForScript(initialRoute.flight)}</script>
    <script type="module" src="/${context.clientBundle.fileName}"></script>
  </body>
</html>`;
}

function renderStyleLinks(styles, manifest) {
  return Array.from(new Set(styles))
    .map((fileName) => {
      const asset = (manifest.assets ?? []).find(
        (candidate) =>
          candidate.type === "style" && candidate.fileName === fileName,
      );
      return `<link rel="stylesheet" href="/${escapeAttribute(fileName)}" data-bundler-style="${escapeAttribute(asset?.bundleKey ?? fileName)}">`;
    })
    .join("\n    ");
}

function resolveStaticAssetRequest(manifest, pathname) {
  const requested = decodeURIComponent(pathname.replace(/^\/+/, ""));
  if (
    !requested ||
    requested.includes("\\") ||
    requested.split("/").includes("..")
  ) {
    return null;
  }
  const candidates = requested.startsWith("assets/")
    ? [requested, requested.slice("assets/".length)]
    : [requested];
  return (manifest.assets ?? []).find((candidate) =>
    candidates.includes(candidate.fileName),
  );
}

async function renderInitialRoute({ routePath, context, dist, AppComponent }) {
  installNodeChunkLoader(dist, context.clientManifest);
  const flight = await renderRscPayloadToString(
    routePath,
    context.clientManifest,
    AppComponent,
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

function renderRscPayloadToString(routePath, clientManifest, AppComponent) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let payload = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      payload += chunk;
    });
    output.on("end", () => resolve(payload));
    output.on("error", reject);
    renderRscPayload(routePath, clientManifest, AppComponent).pipe(output);
  });
}

function renderReactMarkup(model) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let markup = "";
    let failed = false;
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      markup += chunk;
    });
    output.on("end", () => {
      if (!failed) resolve(markup);
    });
    output.on("error", reject);
    const stream = renderHtmlToPipeableStream(model, {
      onAllReady() {
        stream.pipe(output);
      },
      onShellError(error) {
        failed = true;
        reject(error);
      },
      onError(error) {
        failed = true;
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
    const loaded = cache.get(id);
    if (!loaded || typeof loaded.then === "function") {
      throw new Error(`RSC client chunk has not loaded: ${id}`);
    }
    return loaded;
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
  return Object.fromEntries(
    Object.values(clientManifest)
      .filter((record) => record?.id && record?.fileName)
      .map((record) => [
        record.id,
        browser ? (record.url ?? record.fileName) : record.fileName,
      ]),
  );
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
