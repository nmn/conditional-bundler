import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readConditionalAssetRequest,
  resolveRequestOptions,
} from "@bundler/assets/server";
import React from "react";
import { renderToPipeableStream } from "react-dom/server.node";
import { App } from "./App.jsx";
import { Root } from "./Root.jsx";
import { loadRoute } from "./router.js";

const defaultDistDir = path.dirname(fileURLToPath(import.meta.url));
const transformedAssetCache = new Map();

export function createTailwindSpaServer({ dist = defaultDistDir } = {}) {
  return http.createServer((request, response) => {
    void handleTailwindSpaRequest({ dist, request, response }).catch(
      (error) => {
        response.statusCode = 500;
        response.end("Internal server error");
        console.error(error);
      },
    );
  });
}

export async function handleTailwindSpaRequest({
  dist = defaultDistDir,
  request,
  response,
}) {
  if (!response) {
    throw new TypeError("A server response is required.");
  }
  const url = new URL(request.url ?? "/", "http://localhost");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, "manifest.json"), "utf8"),
  );
  const requestOptions = await resolveRequestOptions(
    manifest,
    readUserAgent(request),
  );
  const asset = await readConditionalAssetRequest({
    dist,
    manifest,
    pathname: url.pathname,
    cache: {
      get: (key) => transformedAssetCache.get(key),
      set: (key, value) => transformedAssetCache.set(key, value),
    },
  });
  if (asset.handled) {
    response.statusCode = asset.statusCode;
    response.setHeader("content-type", asset.contentType);
    response.setHeader("x-content-type-options", "nosniff");
    response.end(asset.body);
    return;
  }

  const clientBundle = manifest.bundles.find(
    (bundle) =>
      bundle.targetIds.includes("client") &&
      bundle.entryId.endsWith("client.client.jsx"),
  );
  if (!clientBundle) {
    throw new Error("Missing SPA client bundle.");
  }
  const clientEntrypoint = Object.values(manifest.entrypoints ?? {}).find(
    (entrypoint) =>
      entrypoint.bundleId === clientBundle.id &&
      entrypoint.targetId === "client",
  );
  const styleFiles =
    clientEntrypoint?.styles ??
    Array.from(
      new Set(
        (manifest.assets ?? [])
          .filter((candidate) => candidate.type === "style")
          .map((candidate) => candidate.fileName),
      ),
    );
  const route = await loadRoute(url.pathname);
  await renderReactDocument(
    <Root
      conditionId={requestOptions.resolved.key}
      conditionNames={requestOptions.optionSet.conditions}
      styles={resolveDocumentStyles(styleFiles, manifest)}
    >
      <App routeId={route.id} Route={route.Route} />
    </Root>,
    response,
  );
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

function readUserAgent(request) {
  const value = request?.headers?.["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

const server = createTailwindSpaServer();
const port = Number(process.env.PORT ?? 3600);
server.listen(port, () => {
  console.log(`Tailwind SPA running at http://localhost:${port}`);
});
