import fs from "node:fs";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";

const cjsVirtualPrefix = "virtual:rsc-cjs:";
const builtinRequests = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
const reactPackagePrefixes = [
  "react",
  "react/",
  "react-dom",
  "react-dom/",
  "react-server-dom-webpack",
  "react-server-dom-webpack/",
];

const requireFromPlugin = createRequire(import.meta.url);

export default function reactRscPlugin(options) {
  return createReactRscPlugin(options);
}

export function createReactRscPlugin(options) {
  const root = options.root;
  if (!root) {
    throw new Error("reactRscPlugin requires a project root.");
  }
  const clientEnv = options.clientEnv ?? options.client?.env ?? "client";
  const rscEnv = options.rscEnv ?? options.server?.env ?? "rsc";
  const clientManifestFile =
    options.clientManifestFile ??
    options.client?.manifestFile ??
    "rsc-client-manifest.json";
  const rawClientEntry = options.clientEntry ?? options.client?.entry;
  const clientEntry =
    rawClientEntry === false
      ? undefined
      : resolveProjectPath(root, rawClientEntry ?? "src/client.jsx");
  const clientReferenceEntry = resolveProjectPath(
    root,
    options.clientReferenceEntry ?? options.client?.referenceEntry,
  );
  const discoverClientEntrypoints =
    options.discoverClientEntrypoints ??
    options.client?.discoverClientEntrypoints ??
    true;
  const runtimeEntry =
    options.runtimeEntry === false || options.client?.runtimeEntry === false
      ? undefined
      : options.runtimeEntry === true || options.client?.runtimeEntry === true
        ? path.join(root, ".conditional-bundler", "client.jsx")
        : resolveProjectPath(
            root,
            options.runtimeEntry ?? options.client?.runtimeEntry,
          );
  const jsxRuntime = options.jsxRuntime ?? options.jsx ?? "automatic";
  const jsxOptions =
    jsxRuntime === "classic"
      ? { runtime: "classic" }
      : { runtime: "automatic", importSource: "react" };
  const projectRequire = createRequire(`${root}/package.json`);
  const mode =
    process.env.BUNDLER_MODE === "production" ||
    process.env.NODE_ENV === "production"
      ? "production"
      : "development";

  return {
    name: options.name ?? "react-rsc-example",
    buildStart({ addEntry }) {
      if (clientEntry) {
        addEntry({ id: "client", path: clientEntry, envs: [clientEnv] });
      }
      if (
        clientReferenceEntry &&
        clientReferenceEntry !== clientEntry &&
        !runtimeEntry
      ) {
        addEntry({
          id: "client-references",
          path: clientReferenceEntry,
          envs: [clientEnv],
        });
      }
      if (runtimeEntry) {
        addEntry({ id: "client", path: runtimeEntry, envs: [clientEnv] });
      }
    },
    resolveImport: async ({ request, envId }) => {
      if (isNodeBuiltin(request)) {
        return null;
      }
      if (request.startsWith(cjsVirtualPrefix)) {
        const decoded = decodeCjsVirtualId(request);
        return {
          id: request,
          filePath: decoded.filePath,
          virtual: true,
        };
      }
      if (isReactPackageRequest(request)) {
        const cjsEnvId = getReactCjsEnvId(request, envId, clientEnv);
        const filePath = resolveReactImplementation(
          projectRequire,
          request,
          cjsEnvId,
        );
        return {
          id: encodeCjsVirtualId(cjsEnvId, filePath),
          filePath,
          virtual: true,
        };
      }
      return undefined;
    },
    load({ id, envId }) {
      if (runtimeEntry && id === runtimeEntry) {
        return { code: createRscRuntimeSource(options) };
      }
      if (!id.startsWith(cjsVirtualPrefix)) {
        return undefined;
      }
      const decoded = decodeCjsVirtualId(id);
      return {
        code: createCjsEsmWrapper({
          filePath: decoded.filePath,
          envId: decoded.envId ?? envId,
          mode,
        }),
      };
    },
    transform: {
      default: [
        [
          requireFromPlugin.resolve("@babel/plugin-transform-react-jsx"),
          jsxOptions,
        ],
        [
          "./transform.mjs",
          { root, clientEnv, rscEnv, discoverClientEntrypoints },
        ],
      ],
    },
    buildEnd({ manifest, modules, emitFile }) {
      const records = {};
      for (const moduleRecord of modules) {
        if (moduleRecord.envs[0] !== rscEnv) {
          continue;
        }
        const raw =
          moduleRecord.extraOutputs?.["rsc-client-reference"]?.metadata;
        if (!raw || typeof raw !== "object") {
          continue;
        }
        const metadata = raw;
        const bundle = findClientReferenceBundle(
          manifest,
          clientEnv,
          moduleRecord.id,
          { clientReferenceEntry, runtimeEntry },
        );
        if (!bundle) {
          continue;
        }
        for (const exportName of metadata.exports ?? []) {
          const symbolName = clientReferenceEntry
            ? exportName
            : findExportSymbol(moduleRecord, exportName);
          const stableModuleId = bundle.entryId ?? metadata.clientId;
          records[`${metadata.clientId}#${exportName}`] = {
            id: stableModuleId,
            fileName: bundle.fileName,
            name: symbolName,
            chunks: [stableModuleId, bundle.fileName],
            async: false,
          };
        }
      }
      emitFile({
        fileName: clientManifestFile,
        type: "manifest",
        contents: JSON.stringify(records, null, 2),
      });
    },
  };
}

function isNodeBuiltin(request) {
  return builtinRequests.has(request);
}

function isReactPackageRequest(request) {
  return reactPackagePrefixes.some(
    (prefix) => request === prefix || request.startsWith(prefix),
  );
}

function resolveProjectPath(root, value) {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function encodeCjsVirtualId(envId, filePath) {
  return `${cjsVirtualPrefix}${encodeURIComponent(envId)}:${Buffer.from(
    filePath,
  ).toString("base64url")}`;
}

function decodeCjsVirtualId(id) {
  const payload = id.slice(cjsVirtualPrefix.length);
  const separator = payload.indexOf(":");
  if (separator === -1) {
    return {
      envId: undefined,
      filePath: Buffer.from(payload, "base64url").toString("utf8"),
    };
  }
  return {
    envId: decodeURIComponent(payload.slice(0, separator)),
    filePath: Buffer.from(payload.slice(separator + 1), "base64url").toString(
      "utf8",
    ),
  };
}

function resolveReactImplementation(requireFromProject, request, envId) {
  const reactServer = envId === "rsc";
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

function resolveCjsDependency(fromFilePath, request, envId, mode) {
  if (isNodeBuiltin(request)) {
    return { kind: "builtin", request: toNodeBuiltinSpecifier(request) };
  }

  if (isReactPackageRequest(request)) {
    return {
      kind: "cjs",
      filePath: resolveReactImplementation(
        createRequire(fromFilePath),
        request,
        envId,
      ),
    };
  }

  const requireFromFile = createRequire(fromFilePath);
  const resolved = requireFromFile.resolve(request);
  if (resolved.endsWith(`${path.sep}scheduler${path.sep}index.js`)) {
    return {
      kind: "cjs",
      filePath: path.join(
        path.dirname(resolved),
        "cjs",
        `scheduler.${mode}.js`,
      ),
    };
  }
  return { kind: "cjs", filePath: resolved };
}

function toNodeBuiltinSpecifier(request) {
  return request.startsWith("node:") ? request : `node:${request}`;
}

function createCjsEsmWrapper({ filePath, envId, mode }) {
  const source = fs.readFileSync(filePath, "utf8");
  const conditionalWrapper = createConditionalRequireWrapper({
    source,
    filePath,
    envId,
    mode,
  });
  if (conditionalWrapper) {
    return conditionalWrapper;
  }

  const requires = collectCjsRequires(source);
  const imports = [];
  const cases = [];

  for (const [index, request] of requires.entries()) {
    const local = `__cjs_dep_${index}`;
    const dependency = resolveCjsDependency(filePath, request, envId, mode);
    if (dependency.kind === "builtin") {
      imports.push(
        `import * as ${local} from ${JSON.stringify(dependency.request)};`,
      );
    } else {
      imports.push(
        `import ${local} from ${JSON.stringify(
          encodeCjsVirtualId(envId, dependency.filePath),
        )};`,
      );
    }
    cases.push(`case ${JSON.stringify(request)}: return ${local};`);
  }

  const namedExports = collectCjsNamedExports(source);
  const exportLines = namedExports.map(
    (name) =>
      `export const ${name} = __cjs_default__[${JSON.stringify(name)}];`,
  );
  const webpackShim = path
    .basename(filePath)
    .startsWith("react-server-dom-webpack-client.browser.")
    ? createWebpackRscShimSource()
    : "";

  return `${imports.join("\n")}
${webpackShim}
const __cjs_process__ = { env: { NODE_ENV: ${JSON.stringify(mode)} } };
function __cjs_require__(request) {
  switch (request) {
    ${cases.join("\n    ")}
    default:
      throw new Error("Cannot require " + request + " from ${escapeForStringLiteral(filePath)}");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get(${JSON.stringify(filePath)});
if (!__cjs_default__) {
  const __cjs_module__ = { exports: {} };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set(${JSON.stringify(filePath)}, __cjs_exports__);
  ((module, exports, require, process) => {
${indent(source, 2)}
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__);
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set(${JSON.stringify(filePath)}, __cjs_default__);
}
export default __cjs_default__;
${exportLines.join("\n")}
`;
}

function createConditionalRequireWrapper({ source, filePath, envId, mode }) {
  const selected = selectDirectConditionalRequire(source, mode);
  if (selected) {
    const specifier = encodeCjsDependencySpecifier(
      filePath,
      selected,
      envId,
      mode,
    );
    return `export { default } from ${JSON.stringify(specifier)};
export * from ${JSON.stringify(specifier)};
`;
  }

  const assigned = selectAssignedConditionalRequires(source, mode);
  if (!assigned) {
    return null;
  }
  const exportAssignments = collectVariableExportAssignments(source);
  if (exportAssignments.length === 0) {
    return null;
  }

  const imports = [];
  const imported = new Map();
  for (const variable of new Set(
    exportAssignments.map((item) => item.variable),
  )) {
    const request = assigned.get(variable);
    if (!request) {
      return null;
    }
    const local = `__cjs_selected_${variable}`;
    imported.set(variable, local);
    imports.push(
      `import ${local} from ${JSON.stringify(
        encodeCjsDependencySpecifier(filePath, request, envId, mode),
      )};`,
    );
  }

  const exportLines = exportAssignments.map(
    ({ exported, variable, property }) =>
      `export const ${exported} = ${imported.get(variable)}[${JSON.stringify(
        property,
      )}];`,
  );
  const defaultLines = [
    "const __cjs_default__ = {};",
    ...exportAssignments.map(
      ({ exported }) =>
        `Object.defineProperty(__cjs_default__, ${JSON.stringify(exported)}, { enumerable: true, get: () => ${exported} });`,
    ),
    "export default __cjs_default__;",
  ];

  return `${imports.join("\n")}
${exportLines.join("\n")}
${defaultLines.join("\n")}
`;
}

function selectDirectConditionalRequire(source, mode) {
  const blocks = readNodeEnvConditionalBlocks(source);
  if (!blocks) {
    return null;
  }
  const selectedBlock =
    mode === "production" ? blocks.production : blocks.other;
  const match = selectedBlock.match(
    /module\.exports\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/,
  );
  return match?.[1] ?? null;
}

function selectAssignedConditionalRequires(source, mode) {
  const blocks = readNodeEnvConditionalBlocks(source);
  if (!blocks) {
    return null;
  }
  const selectedBlock =
    mode === "production" ? blocks.production : blocks.other;
  const assigned = new Map();
  const pattern =
    /\b([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of selectedBlock.matchAll(pattern)) {
    assigned.set(match[1], match[2]);
  }
  return assigned.size > 0 ? assigned : null;
}

function readNodeEnvConditionalBlocks(source) {
  const match = source.match(
    /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*["']production["']\s*\)\s*\{([\s\S]*?)\}\s*else\s*\{([\s\S]*?)\}/,
  );
  return match ? { production: match[1], other: match[2] } : null;
}

function collectVariableExportAssignments(source) {
  const exports = [];
  const pattern =
    /\bexports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*;/g;
  for (const match of source.matchAll(pattern)) {
    exports.push({
      exported: match[1],
      variable: match[2],
      property: match[3],
    });
  }
  return exports;
}

function encodeCjsDependencySpecifier(filePath, request, envId, mode) {
  const dependency = resolveCjsDependency(filePath, request, envId, mode);
  if (dependency.kind === "builtin") {
    return dependency.request;
  }
  return encodeCjsVirtualId(envId, dependency.filePath);
}

function collectCjsRequires(source) {
  const requires = new Set();
  const pattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    requires.add(match[1]);
  }
  return Array.from(requires);
}

function collectCjsNamedExports(source) {
  const exports = new Set();
  const pattern = /\bexports\.([A-Za-z_$][\w$]*)\s*=/g;
  for (const match of source.matchAll(pattern)) {
    exports.add(match[1]);
  }
  return Array.from(exports).sort();
}

function createRscRuntimeSource(options) {
  const endpoint = options.rscEndpoint ?? "/rsc";
  const clientReferenceEntry = resolveProjectPath(
    options.root,
    options.clientReferenceEntry ?? options.client?.referenceEntry,
  );
  const clientReferenceExports = clientReferenceEntry
    ? `export * from ${JSON.stringify(clientReferenceEntry)};\n`
    : "";
  return `import React, { startTransition, use, useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createFromFetch, createFromReadableStream } from "react-server-dom-webpack/client.browser";
${clientReferenceExports}

function RscView({ response }) {
  return use(response);
}

function ClientApp({ initialRoute }) {
  const [route, setRoute] = useState(
    () => initialRoute ?? createRouteState(currentPath()),
  );

  useEffect(() => {
    const navigate = (to) => {
      const next = normalizePath(to);
      if (next === currentPath()) {
        return;
      }
      window.history.pushState(null, "", next);
      startTransition(() => setRoute(createRouteState(next)));
    };
    const refresh = (path = currentPath()) => {
      startTransition(() => setRoute(createRouteState(normalizePath(path))));
    };
    const onNavigate = (event) => {
      event.preventDefault();
      navigate(event.detail?.path ?? currentPath());
    };
    const onPopState = () => refresh();
    const onRscRefresh = (event) => {
      event.preventDefault();
      refresh();
    };
    window.addEventListener("bundler:rsc-navigate", onNavigate);
    window.addEventListener("bundler:rsc-refresh", onRscRefresh);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("bundler:rsc-navigate", onNavigate);
      window.removeEventListener("bundler:rsc-refresh", onRscRefresh);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return React.createElement(RscView, { response: route.response });
}

function createRouteState(path) {
  return {
    path,
    response: createFromFetch(
      fetch(${JSON.stringify(endpoint)} + "?path=" + encodeURIComponent(path), {
        headers: { accept: "text/x-component" },
      }),
    ),
  };
}

function readInitialRouteState() {
  const script = document.getElementById("__BUNDLER_RSC_DATA__");
  if (!script) {
    return null;
  }
  const payload = JSON.parse(script.textContent || '""');
  const path = normalizePath(script.dataset.path || currentPath());
  script.remove();
  return {
    path,
    response: createFromReadableStream(createFlightStream(payload)),
  };
}

function installInitialChunkMap() {
  const script = document.getElementById("__BUNDLER_RSC_CHUNKS__");
  if (!script) {
    return;
  }
  const chunks = globalThis.__BUNDLER_RSC_CHUNKS__ ??= {};
  Object.assign(chunks, JSON.parse(script.textContent || "{}"));
  script.remove();
}

function createFlightStream(payload) {
  const bytes = new TextEncoder().encode(payload);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function currentPath() {
  return normalizePath(window.location.pathname + window.location.search);
}

function normalizePath(path) {
  return path && path.startsWith("/") ? path : "/" + (path || "");
}

if (typeof document !== "undefined") {
  installInitialChunkMap();
  const rootElement = document.getElementById("root");
  const app = React.createElement(ClientApp, {
    initialRoute: readInitialRouteState(),
  });
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, app);
  } else {
    createRoot(rootElement).render(app);
  }
}
`;
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

function findClientReferenceBundle(
  manifest,
  clientEnv,
  moduleId,
  { clientReferenceEntry, runtimeEntry } = {},
) {
  return (
    (clientReferenceEntry && runtimeEntry
      ? manifest.bundles.find(
          (bundle) =>
            bundle.envId === clientEnv && bundle.entryId === runtimeEntry,
        )
      : undefined) ??
    (clientReferenceEntry
      ? manifest.bundles.find(
          (bundle) =>
            bundle.envId === clientEnv &&
            bundle.entryId === clientReferenceEntry,
        )
      : undefined) ??
    manifest.bundles.find(
      (bundle) => bundle.envId === clientEnv && bundle.entryId === moduleId,
    ) ??
    manifest.bundles.find(
      (bundle) =>
        bundle.envId === clientEnv && bundle.modules?.[0] === moduleId,
    ) ??
    manifest.bundles.find(
      (bundle) =>
        bundle.envId === clientEnv && bundle.modules?.includes(moduleId),
    )
  );
}

function findExportSymbol(moduleRecord, exportName) {
  const local =
    moduleRecord.exportsLocal?.find((item) => item.exported === exportName)
      ?.local ?? exportName;
  return `${moduleRecord.prefix}_${local}`;
}

function indent(source, spaces) {
  const prefix = " ".repeat(spaces);
  return source
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
}

function escapeForStringLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
