import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToPipeableStream } from "react-server-dom-webpack/server.node";
import { registerClientReference as __registerClientReference } from "react-server-dom-webpack/server";
import App from "./App.jsx";

void __registerClientReference;

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
    <script type="module" src="/assets/${clientBundle.fileName}"></script>
  </body>
</html>`);
});

server.listen(3000, () => {
  console.log("React RSC example running at http://localhost:3000");
});

const importMap = {
  imports: {
    react: "https://esm.sh/react@19.2.5",
    "react/jsx-runtime": "https://esm.sh/react@19.2.5/jsx-runtime",
    "react-dom/client": "https://esm.sh/react-dom@19.2.5/client",
    "react-server-dom-webpack/client.browser":
      "https://esm.sh/react-server-dom-webpack@19.2.5/client.browser",
  },
};

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
