import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToPipeableStream as renderHtmlToPipeableStream } from "react-dom/server";
import { createFromNodeStream } from "@bundler/react-server-dom/client.node";
import { renderToPipeableStream as renderRscToPipeableStream } from "@bundler/react-server-dom/server.node";

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
    renderRscPayload(url.searchParams.get("path") ?? "/", AppComponent).pipe(
      response,
    );
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
  const resolvedClientBundle =
    clientBundle ??
    manifest.bundles.find(
      (bundle) =>
        bundle.targetIds.includes("client") &&
        bundle.environmentIds.includes("react.client") &&
        bundle.entryId.endsWith("runtime-client.js"),
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
    clientBundle: resolvedClientBundle,
    clientEntrypoint,
    documentStyles: Array.from(
      new Set([
        ...(serverEntrypoint?.styles ?? []),
        ...(clientEntrypoint?.styles ?? []),
      ]),
    ),
  };
}

function renderRscPayload(routePath, AppComponent) {
  const routeUrl = new URL(routePath, "http://localhost");
  return renderRscToPipeableStream(
    <AppComponent
      path={`${routeUrl.pathname}${routeUrl.search}`}
      searchParams={Object.fromEntries(routeUrl.searchParams)}
    />,
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
  const flight = await renderRscPayloadToString(routePath, AppComponent);
  const model = await createFromNodeStream(Readable.from([flight]));
  return {
    flight,
    markup: await renderReactMarkup(model),
  };
}

function renderRscPayloadToString(routePath, AppComponent) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let payload = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      payload += chunk;
    });
    output.on("end", () => resolve(payload));
    output.on("error", reject);
    renderRscPayload(routePath, AppComponent).pipe(output);
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
