import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { applyConditionIdToUrl } from "@bundler/assets/runtime";
import {
  readConditionalAssetRequest,
  resolveRequestOptions,
} from "@bundler/assets/server";
import React from "react";
import { renderToPipeableStream } from "react-dom/server.node";
import { createFromNodeStream } from "@bundler/react-server-dom/client.node";
import { renderToPipeableStream as renderRscToPipeableStream } from "@bundler/react-server-dom/server.node";
import App from "./App.jsx";
import { Root } from "./Root.jsx";

const defaultDistDir = path.dirname(fileURLToPath(import.meta.url));
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

export async function handleBasicRequest({
  request,
  response,
  url,
  clientBundle,
  dist = defaultDistDir,
} = {}) {
  if (!response) {
    throw new TypeError("A server response is required.");
  }
  const context = loadContext({ dist, clientBundle });
  const requestOptions = await resolveRequestOptions(
    context.manifest,
    readUserAgent(request),
  );
  if (url.pathname === "/rsc") {
    response.setHeader("content-type", "text/x-component");
    renderRscPayload(url.searchParams.get("path") ?? "/", requestOptions).pipe(
      response,
    );
    return;
  }

  const staticAsset = await readConditionalAssetRequest({
    dist,
    manifest: context.manifest,
    pathname: url.pathname,
    cache: {
      get: (key) => transformedAssetCache.get(key),
      set: (key, value) => transformedAssetCache.set(key, value),
    },
  });
  if (staticAsset.handled) {
    response.statusCode = staticAsset.statusCode;
    response.setHeader("content-type", staticAsset.contentType);
    response.setHeader("x-content-type-options", "nosniff");
    response.end(staticAsset.body);
    return;
  }

  await renderDocument({
    context,
    requestOptions,
    response,
    routePath: `${url.pathname}${url.search}`,
  });
}

export function disposeBasicServer() {}

function loadContext({ dist, clientBundle }) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, "manifest.json"), "utf8"),
  );
  const resolvedClientBundle =
    clientBundle ??
    manifest.bundles.find(
      (bundle) =>
        bundle.targetIds.includes("client") &&
        bundle.environmentIds.includes("react.client") &&
        bundle.entryId.endsWith("client.jsx"),
    );
  if (!resolvedClientBundle) {
    throw new Error("Missing client runtime bundle.");
  }
  const serverBundle = manifest.bundles.find((bundle) =>
    (bundle.entrypoints ?? []).some(
      (entrypoint) =>
        entrypoint.targetId === "server" &&
        entrypoint.environmentId === "react.server" &&
        entrypoint.exportMode === "entry",
    ),
  );
  const serverEntrypoint = Object.values(manifest.entrypoints ?? {}).find(
    (entrypoint) =>
      entrypoint.bundleId === serverBundle?.id &&
      entrypoint.targetId === "server" &&
      entrypoint.environmentId === "react.server",
  );
  const clientEntrypoint = Object.values(manifest.entrypoints ?? {}).find(
    (entrypoint) =>
      entrypoint.bundleId === resolvedClientBundle.id &&
      entrypoint.targetId === "client" &&
      entrypoint.environmentId === "react.client",
  );
  return {
    manifest,
    documentStyles: Array.from(
      new Set([
        ...(serverEntrypoint?.styles ?? []),
        ...(clientEntrypoint?.styles ?? []),
      ]),
    ),
  };
}

function renderRscPayload(routePath, requestOptions) {
  const routeUrl = new URL(routePath, "http://localhost");
  return renderRscToPipeableStream(
    <App
      path={`${routeUrl.pathname}${routeUrl.search}`}
      searchParams={Object.fromEntries(routeUrl.searchParams)}
    />,
    {
      mapClientChunk: (url) =>
        applyConditionIdToUrl(
          url,
          requestOptions.optionSet,
          requestOptions.resolved.key,
        ),
    },
  );
}

async function renderDocument({
  context,
  requestOptions,
  response,
  routePath,
}) {
  const initialRoute = await loadInitialRoute(routePath, requestOptions);
  await renderReactDocument(
    <Root
      app={initialRoute.model}
      conditionId={requestOptions.resolved.key}
      conditionNames={requestOptions.optionSet.conditions}
      flight={initialRoute.flight}
      routePath={routePath}
      styles={resolveDocumentStyles(context.documentStyles, context.manifest)}
    />,
    response,
  );
}

function resolveDocumentStyles(styles, manifest) {
  return Array.from(new Set(styles)).map((fileName) => {
    const asset = (manifest.assets ?? []).find(
      (candidate) =>
        candidate.type === "style" && candidate.fileName === fileName,
    );
    return {
      fileName,
      bundleKey: asset?.bundleKey ?? fileName,
    };
  });
}

async function loadInitialRoute(routePath, requestOptions) {
  const flight = await renderRscPayloadToString(routePath, requestOptions);
  const model = await createFromNodeStream(Readable.from([flight]));
  return {
    flight,
    model,
  };
}

function renderRscPayloadToString(routePath, requestOptions) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let payload = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      payload += chunk;
    });
    output.on("end", () => resolve(payload));
    output.on("error", reject);
    renderRscPayload(routePath, requestOptions).pipe(output);
  });
}

function readUserAgent(request) {
  const value = request?.headers?.["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function renderReactDocument(model, response) {
  return new Promise((resolve, reject) => {
    let didError = false;
    const stream = renderToPipeableStream(model, {
      onShellReady() {
        response.statusCode = didError ? 500 : 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.once("finish", resolve);
        response.once("error", reject);
        stream.pipe(response);
      },
      onShellError(error) {
        reject(error);
      },
      onError(error) {
        didError = true;
        console.error(error);
      },
    });
  });
}

if (!globalThis.__BUNDLER_RSC_DEV__) {
  const server = createBasicServer();
  const port = Number(process.env.PORT ?? 3100);
  server.listen(port, () => {
    console.log(`Basic RSC example running at http://localhost:${port}`);
  });
}
