import { createRequire } from "node:module";
import path from "node:path";

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
    load({ id }) {
      if (runtimeEntry && id === runtimeEntry) {
        return { code: createRscRuntimeSource(options) };
      }
      return undefined;
    },
    transform: [
      [
        requireFromPlugin.resolve("@babel/plugin-transform-react-jsx"),
        jsxOptions,
      ],
      [
        "./transform.mjs",
        { root, clientEnv, rscEnv, discoverClientEntrypoints },
      ],
    ],
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

function resolveProjectPath(root, value) {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.join(root, value);
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
