import { createRequire } from "node:module";
import path from "node:path";

const reactPackageRequests = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
  "react-dom/server",
  "react-dom/server.node",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client",
  "react-server-dom-webpack/client.node",
  "react-server-dom-webpack/server",
  "react-server-dom-webpack/server.node",
];

export function createReactRscCjsOptions(options) {
  const root = options.root;
  const clientEnv = options.clientEnv ?? "client";
  const rscEnv = options.rscEnv ?? "rsc";
  const projectRequire = createRequire(`${root}/package.json`);
  const envIds = [clientEnv, rscEnv];
  const dependencyMappings = Object.fromEntries(
    envIds.map((envId) => [
      envId,
      Object.fromEntries(
        reactPackageRequests.map((request) => [
          request,
          resolveReactImplementation(projectRequire, request, envId, rscEnv),
        ]),
      ),
    ]),
  );
  const entryMappings = Object.fromEntries(
    envIds.map((envId) => [
      envId,
      Object.fromEntries(
        reactPackageRequests.map((request) => {
          const cjsEnvId = getReactCjsEnvId(request, envId, clientEnv);
          return [
            request,
            {
              envId: cjsEnvId,
              filePath: resolveReactImplementation(
                projectRequire,
                request,
                cjsEnvId,
                rscEnv,
              ),
            },
          ];
        }),
      ),
    ]),
  );

  return {
    dependencyMappings,
    entryMappings,
    preambles: [
      {
        fileNamePrefix: "react-server-dom-webpack-client.browser.",
        code: createWebpackRscShimSource(),
      },
    ],
  };
}

function resolveReactImplementation(
  requireFromProject,
  request,
  envId,
  rscEnv,
) {
  const reactServer = envId === rscEnv;
  const packageRoot = (pkg) =>
    path.dirname(requireFromProject.resolve(`${pkg}/package.json`));

  switch (request) {
    case "react":
      return path.join(
        packageRoot("react"),
        reactServer ? "react.react-server.js" : "index.js",
      );
    case "react/jsx-runtime":
      return path.join(
        packageRoot("react"),
        reactServer ? "jsx-runtime.react-server.js" : "jsx-runtime.js",
      );
    case "react/jsx-dev-runtime":
      return path.join(
        packageRoot("react"),
        reactServer ? "jsx-dev-runtime.react-server.js" : "jsx-dev-runtime.js",
      );
    case "react-dom":
      return path.join(
        packageRoot("react-dom"),
        reactServer ? "react-dom.react-server.js" : "index.js",
      );
    case "react-dom/client":
      return path.join(packageRoot("react-dom"), "client.js");
    case "react-dom/server":
    case "react-dom/server.node":
      return path.join(packageRoot("react-dom"), "server.node.js");
    case "react-server-dom-webpack/client.browser":
    case "react-server-dom-webpack/client":
      return path.join(
        packageRoot("react-server-dom-webpack"),
        "client.browser.js",
      );
    case "react-server-dom-webpack/client.node":
      return path.join(
        packageRoot("react-server-dom-webpack"),
        "client.node.js",
      );
    case "react-server-dom-webpack/server":
    case "react-server-dom-webpack/server.node":
      return path.join(
        packageRoot("react-server-dom-webpack"),
        "server.node.js",
      );
    default:
      throw new Error(`Unsupported React RSC package import '${request}'.`);
  }
}

function getReactCjsEnvId(request, envId, clientEnv) {
  if (
    request === "react-dom/server" ||
    request === "react-dom/server.node" ||
    request === "react-server-dom-webpack/client.node"
  ) {
    return clientEnv;
  }
  return envId;
}

function createWebpackRscShimSource() {
  return `const __bundler_rsc_module_cache__ = globalThis.__BUNDLER_RSC_MODULE_CACHE__ ??= new Map();
const __bundler_rsc_load_chunk__ = (chunkId) => {
  const fileName = globalThis.__webpack_require__.u(chunkId);
  const href = fileName.startsWith("/") ? fileName : "/assets/" + fileName;
  const loading = import(href).then((module) => {
    __bundler_rsc_module_cache__.set(chunkId, module);
    __bundler_rsc_module_cache__.set(fileName, module);
    return module;
  });
  __bundler_rsc_module_cache__.set(chunkId, loading);
  return loading;
};
if (typeof globalThis.__webpack_require__ !== "function") {
  globalThis.__webpack_require__ = (id) => {
    const module = __bundler_rsc_module_cache__.get(id);
    if (!module) {
      throw new Error("RSC client chunk has not loaded: " + id);
    }
    return module;
  };
}
globalThis.__webpack_require__.u ??= (chunkId) => chunkId;
const __bundler_rsc_chunk_files__ = globalThis.__BUNDLER_RSC_CHUNKS__ ??= {};
const __bundler_rsc_chunk_file__ = (chunkId) =>
  __bundler_rsc_chunk_files__[chunkId] ?? chunkId;
globalThis.__webpack_require__.u = (chunkId) =>
  __bundler_rsc_chunk_file__(chunkId);
globalThis.__webpack_get_script_filename__ = (chunkId) =>
  globalThis.__webpack_require__.u(chunkId);
globalThis.__webpack_chunk_load__ = (chunkId) => {
  const cached = __bundler_rsc_module_cache__.get(chunkId);
  if (cached) {
    return typeof cached.then === "function" ? cached : Promise.resolve(cached);
  }
  return __bundler_rsc_load_chunk__(chunkId);
};
`;
}
