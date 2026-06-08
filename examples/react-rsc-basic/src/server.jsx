import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToPipeableStream } from "react-server-dom-webpack/server.node";
import { registerClientReference as __registerClientReference } from "react-server-dom-webpack/server";
import App from "./App.jsx";

globalThis.__registerClientReference = __registerClientReference;

const distDir = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(distDir, "manifest.json"), "utf8"),
);
const clientBundle = manifest.bundles.find(
  (bundle) =>
    bundle.envId === "client" && bundle.entryId.endsWith("client.jsx"),
);
const clientManifest = JSON.parse(
  fs.readFileSync(path.join(distDir, "rsc-client-manifest.json"), "utf8"),
);

const server = http.createServer(async (request, response) => {
  if (request.url === "/rsc") {
    response.setHeader("content-type", "text/x-component");
    renderToPipeableStream(<App />, clientManifest).pipe(response);
    return;
  }

  if (request.url?.startsWith("/assets/")) {
    const fileName = path.basename(request.url);
    response.setHeader("content-type", "text/javascript");
    response.end(fs.readFileSync(path.join(distDir, fileName), "utf8"));
    return;
  }

  response.setHeader("content-type", "text/html");
  response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>conditional-bundler RSC</title>
    <style>${style}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="importmap">${JSON.stringify(importMap)}</script>
    <script type="module">${webpackRscShim}</script>
    <script type="module" src="/assets/${clientBundle.fileName}"></script>
  </body>
</html>`);
});

server.listen(3000, () => {
  console.log("React RSC example running at http://localhost:3000");
});

const importMap = {
  imports: {
    react: cdn("react"),
    "react/jsx-runtime": cdn("react/jsx-runtime"),
    "react-dom": cdn("react-dom"),
    "react-dom/client": cdn("react-dom/client"),
    "react-server-dom-webpack/client.browser": cdn(
      "react-server-dom-webpack/client.browser",
    ),
  },
};

function cdn(specifier) {
  const [pkg, ...subpath] = specifier.split("/");
  const packageName = pkg.startsWith("@") ? `${pkg}/${subpath.shift()}` : pkg;
  const rest = subpath.length > 0 ? `/${subpath.join("/")}` : "";
  const dev = process.env.NODE_ENV === "production" ? "" : "?dev";
  return `https://esm.sh/${packageName}@19.2.5${rest}${dev}`;
}

const webpackRscShim = `
const moduleCache = new Map();
const loadChunk = (chunkId) => {
  const fileName = globalThis.__webpack_require__.u(chunkId);
  const href = fileName.startsWith("/") ? fileName : "/assets/" + fileName;
  const loading = import(href).then((module) => {
    moduleCache.set(chunkId, module);
    moduleCache.set(fileName, module);
    return module;
  });
  moduleCache.set(chunkId, loading);
  return loading;
};
globalThis.__webpack_require__ = (id) => {
  const module = moduleCache.get(id);
  if (!module) {
    throw new Error("RSC client chunk has not loaded: " + id);
  }
  return module;
};
globalThis.__webpack_require__.u = (chunkId) => chunkId;
globalThis.__webpack_get_script_filename__ = (chunkId) =>
  globalThis.__webpack_require__.u(chunkId);
globalThis.__webpack_chunk_load__ = (chunkId) => {
  const cached = moduleCache.get(chunkId);
  if (cached) {
    return typeof cached.then === "function" ? cached : Promise.resolve(cached);
  }
  return loadChunk(chunkId);
};
`;

const style = `
html {
  background: #f6f2ea;
  color: #1f2524;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
}
body {
  margin: 0;
}
button {
  border: 1px solid #1f2524;
  background: #d6ff62;
  color: #1f2524;
  cursor: pointer;
  font: inherit;
  padding: 0.75rem 1rem;
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
.counter {
  align-items: center;
  border: 1px solid #1f2524;
  display: flex;
  justify-content: space-between;
  max-width: 460px;
  padding: 20px;
}
.counter strong {
  display: block;
  font-size: 4rem;
  line-height: 1;
}
`;
