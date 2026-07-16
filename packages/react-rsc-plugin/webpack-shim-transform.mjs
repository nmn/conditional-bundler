import path from "node:path";
import { parse } from "@babel/parser";

const WEBPACK_RSC_SHIM = `const __bundler_rsc_module_cache__ = globalThis.__BUNDLER_RSC_MODULE_CACHE__ ??= new Map();
const __bundler_rsc_load_chunk__ = (chunkId) => {
  const fileName = globalThis.__webpack_require__.u(chunkId);
  const href = fileName.startsWith("/") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(fileName)
    ? fileName
    : "/" + fileName;
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

export default function webpackRscShimBabelPlugin(api, options) {
  const t = api.types;
  return {
    name: "react-rsc-webpack-shim",
    visitor: {
      Program: {
        exit(programPath, state) {
          const filePath = options.filePath ?? state.filename;
          if (
            options.envId !== (options.clientEnv ?? "client") ||
            !path
              .basename(filePath)
              .startsWith("react-server-dom-webpack-client.browser.")
          ) {
            return;
          }
          const body = parse(WEBPACK_RSC_SHIM, {
            sourceType: "module",
          }).program.body;
          programPath.node.body.unshift(
            ...body.map((node) => t.removePropertiesDeep(node)),
          );
        },
      },
    },
  };
}
