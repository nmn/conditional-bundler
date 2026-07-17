import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDistDir = path.dirname(fileURLToPath(import.meta.url));

export function createSpaExampleServer({
  render,
  title,
  clientEntrySuffix = "client.client.jsx",
  dist = defaultDistDir,
}) {
  return http.createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      response.statusCode = 500;
      response.end("Internal server error");
      console.error(error);
    });
  });

  async function handleRequest(request, response) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dist, "manifest.json"), "utf8"),
    );
    const fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const asset = (manifest.assets ?? []).find(
      (candidate) => candidate.fileName === fileName,
    );
    if (asset) {
      response.setHeader(
        "content-type",
        asset.contentType ?? "application/octet-stream",
      );
      response.end(fs.readFileSync(path.join(dist, asset.fileName)));
      return;
    }
    const logicalEntry = Object.entries(manifest.entrypoints ?? {}).find(
      ([key]) => key.startsWith("client:") && key.endsWith(clientEntrySuffix),
    )?.[1];
    const clientBundle = logicalEntry
      ? manifest.bundles.find((bundle) => bundle.id === logicalEntry.bundleId)
      : manifest.bundles.find(
          (bundle) =>
            (bundle.environmentIds ?? [bundle.envId]).includes("client") &&
            bundle.entryId.endsWith(clientEntrySuffix),
        );
    if (!clientBundle) {
      throw new Error("Missing SPA client bundle.");
    }
    const markup = await render(url);
    const styles =
      logicalEntry?.styles ??
      Array.from(
        new Set(
          (manifest.assets ?? [])
            .filter((candidate) => candidate.type === "style")
            .map((candidate) => candidate.fileName),
        ),
      );
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeAttribute(title)}</title>
    ${styles
      .map((style) => {
        const asset = (manifest.assets ?? []).find(
          (candidate) =>
            candidate.type === "style" && candidate.fileName === style,
        );
        return `<link rel="stylesheet" href="/${escapeAttribute(style)}" data-bundler-style="${escapeAttribute(asset?.bundleKey ?? style)}">`;
      })
      .join("\n    ")}
  </head>
  <body>
    <div id="root">${markup}</div>
    <script type="module" src="/${clientBundle.fileName}"></script>
  </body>
</html>`);
  }
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
