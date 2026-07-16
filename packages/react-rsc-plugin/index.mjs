import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCjsModuleIdentity } from "@bundler/cjs-to-esm";

const requireFromPlugin = createRequire(import.meta.url);
const reactPackageRequests = new Set([
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
]);

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
        ? fileURLToPath(new URL("./runtime-client.js", import.meta.url))
        : resolveProjectPath(
            root,
            options.runtimeEntry ?? options.client?.runtimeEntry,
          );
  const jsxRuntime = options.jsxRuntime ?? options.jsx ?? "automatic";
  const jsxOptions =
    jsxRuntime === "classic"
      ? { runtime: "classic" }
      : { runtime: "automatic", importSource: "react" };
  const projectRequire = createRequire(path.join(root, "package.json"));
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
    resolveImport(context) {
      if (!reactPackageRequests.has(context.request)) {
        return undefined;
      }

      const parentEnv = context.importerMeta?.reactCjsEnv ?? context.envId;
      const cjsEnv = getReactCjsEnvId(context.request, parentEnv, clientEnv);
      const filePath = resolveReactImplementation(
        projectRequire,
        context.request,
        cjsEnv,
        rscEnv,
      );
      return {
        id: filePath,
        filePath,
        moduleIdentity: createCjsModuleIdentity(filePath),
        type: "javascript",
        meta: { format: "commonjs", reactCjsEnv: cjsEnv },
      };
    },
    transform: [
      [
        requireFromPlugin.resolve("@babel/plugin-transform-react-jsx"),
        jsxOptions,
      ],
      [
        "./transform.mjs",
        {
          root,
          clientEnv,
          rscEnv,
          discoverClientEntrypoints,
          runtimeTemplatePath: fileURLToPath(
            new URL("./runtime-client.js", import.meta.url),
          ),
          rscEndpoint: options.rscEndpoint ?? "/rsc",
          clientReferenceEntry,
        },
      ],
      ["./webpack-shim-transform.mjs", { clientEnv }],
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

function resolveProjectPath(root, value) {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.join(root, value);
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
