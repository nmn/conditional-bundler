import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCjsModuleIdentity } from "@bundler/cjs-to-esm";

const requireFromPlugin = createRequire(import.meta.url);
const reactPackageRequests = new Set([
  "react",
  "react-server",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server/jsx-runtime",
  "react-server/jsx-dev-runtime",
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
  if (!root) throw new Error("reactRscPlugin requires a project root.");

  const serverEnvironment =
    options.serverEnvironment ??
    options.rscEnvironment ??
    options.rscEnv ??
    "react.server";
  const clientEnvironment =
    options.clientEnvironment ?? options.clientEnv ?? "react.client";
  const serverTarget = options.serverTarget ?? "server";
  const clientTarget = options.clientTarget ?? "client";
  const rawClientEntry = options.clientEntry ?? options.client?.entry;
  const clientEntry =
    rawClientEntry === false
      ? undefined
      : resolveProjectPath(root, rawClientEntry ?? "src/client.jsx");
  const clientReferenceEntry = resolveProjectPath(
    root,
    options.clientReferenceEntry ?? options.client?.referenceEntry,
  );
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
  const rscBindingRequire = createRequire(
    requireFromPlugin.resolve("@bundler/react-server-dom/server.node"),
  );

  return {
    name: options.name ?? "react-rsc",
    representations: {
      "rsc-client-chunks": { extends: "url_and_deps_array" },
      "rsc-ssr-chunks": { extends: "url_and_deps_array" },
    },
    buildStart({ addEntry }) {
      if (clientEntry) {
        addEntry({
          path: clientEntry,
          environment: clientEnvironment,
          targets: [clientTarget],
        });
      }
      if (
        clientReferenceEntry &&
        clientReferenceEntry !== clientEntry &&
        !runtimeEntry
      ) {
        addEntry({
          path: clientReferenceEntry,
          environment: clientEnvironment,
          targets: [clientTarget],
        });
      }
      if (runtimeEntry) {
        addEntry({
          path: runtimeEntry,
          environment: clientEnvironment,
          targets: [clientTarget],
        });
      }
    },
    resolveImport(context) {
      if (!reactPackageRequests.has(context.request)) return undefined;

      const runtimeEnvironment =
        context.importerMeta?.reactRuntimeEnvironment ??
        context.importerMeta?.reactCjsEnv ??
        context.environmentId;
      const resolvedEnvironment = getReactRuntimeEnvironment(
        context.request,
        runtimeEnvironment,
        clientEnvironment,
      );
      const filePath = resolveReactImplementation(
        projectRequire,
        rscBindingRequire,
        context.request,
        resolvedEnvironment === serverEnvironment,
      );
      return {
        id: filePath,
        filePath,
        moduleIdentity: createCjsModuleIdentity(filePath),
        type: "javascript",
        meta: {
          format: "commonjs",
          reactRuntimeEnvironment: resolvedEnvironment,
          reactCjsEnv: resolvedEnvironment,
        },
      };
    },
    transform: [
      [
        requireFromPlugin.resolve("@babel/plugin-transform-react-jsx"),
        jsxOptions,
      ],
      [
        "./runtime-transform.mjs",
        {
          runtimeTemplatePath: fileURLToPath(
            new URL("./runtime-client.js", import.meta.url),
          ),
          rscEndpoint: options.rscEndpoint ?? "/rsc",
          clientReferenceEntry,
        },
      ],
      {
        plugin: [
          "./transform.mjs",
          {
            root,
            serverEnvironment,
            clientEnvironment,
            serverTarget,
            clientTarget,
          },
        ],
        environments: [serverEnvironment],
      },
      "./inline-runtime-transform.mjs",
    ],
    transformPre: [
      {
        plugin: [
          "./react-server-import-transform.mjs",
          {
            clientEnvironment,
            rewriteRequires: true,
          },
        ],
        environments: [serverEnvironment],
      },
    ],
    transformFinalize: [
      {
        plugin: [
          "./react-server-import-transform.mjs",
          {
            clientEnvironment,
            rewriteRequires: false,
          },
        ],
        environments: [serverEnvironment],
      },
    ],
    buildEnd(context) {
      const clientReferenceBundles = {};
      for (const moduleRecord of context.modules) {
        const representation = moduleRecord.resolutionMeta?.representation;
        if (
          representation !== "rsc-client-chunks" &&
          representation !== "rsc-ssr-chunks"
        ) {
          continue;
        }
        const outputId = moduleRecord.linkReferences?.find(
          (reference) =>
            reference.kind === "output-url" &&
            reference.outputType === "script",
        )?.outputId;
        if (!outputId) continue;
        const referenceTarget = moduleRecord.linkReferences?.find(
          (reference) =>
            reference.kind === "output-url" &&
            reference.outputType === "script",
        )?.targetId;
        const assetId = moduleRecord.resolutionMeta?.assetId;
        const relative =
          typeof assetId === "string" && assetId.includes("::")
            ? assetId.slice(assetId.indexOf("::") + 2)
            : path
                .relative(root, moduleRecord.filePath)
                .split(path.sep)
                .join("/");
        const sourcePath = path.resolve(root, relative);
        const bundle = context.bundles.find(
          (candidate) =>
            (!referenceTarget ||
              candidate.targetIds.includes(referenceTarget)) &&
            (candidate.entryId === outputId ||
              candidate.entryId === sourcePath ||
              candidate.modules.includes(outputId) ||
              candidate.modules.includes(sourcePath) ||
              candidate.entrypoints.some(
                (entrypoint) =>
                  entrypoint.entryId === outputId ||
                  entrypoint.entryId === sourcePath,
              )),
        );
        if (!bundle) continue;
        const logicalId = relative.startsWith("/") ? relative : `/${relative}`;
        clientReferenceBundles[logicalId] ??= {};
        clientReferenceBundles[logicalId][referenceTarget ?? bundle.targetId] =
          bundle.id;
      }
      context.manifest.metadata.rsc = {
        inline: true,
        clientReferenceBundles,
      };
    },
  };
}

function resolveReactImplementation(
  requireFromProject,
  requireFromRscBinding,
  request,
  reactServer,
) {
  const packageRoot = (pkg) =>
    path.dirname(requireFromProject.resolve(`${pkg}/package.json`));
  const rscPackageRoot = path.dirname(
    requireFromRscBinding.resolve("react-server-dom-webpack/package.json"),
  );

  switch (request) {
    case "react":
      return path.join(packageRoot("react"), "index.js");
    case "react-server":
      return path.join(packageRoot("react"), "react.react-server.js");
    case "react/jsx-runtime":
      return path.join(packageRoot("react"), "jsx-runtime.js");
    case "react/jsx-dev-runtime":
      return path.join(packageRoot("react"), "jsx-dev-runtime.js");
    case "react-server/jsx-runtime":
      return path.join(packageRoot("react"), "jsx-runtime.react-server.js");
    case "react-server/jsx-dev-runtime":
      return path.join(packageRoot("react"), "jsx-dev-runtime.react-server.js");
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
      return path.join(rscPackageRoot, "client.browser.js");
    case "react-server-dom-webpack/client.node":
      return path.join(rscPackageRoot, "client.node.js");
    case "react-server-dom-webpack/server":
    case "react-server-dom-webpack/server.node":
      return path.join(rscPackageRoot, "server.node.js");
    default:
      throw new Error(`Unsupported React RSC package import '${request}'.`);
  }
}

function getReactRuntimeEnvironment(request, environmentId, clientEnvironment) {
  if (
    request === "react-dom/server" ||
    request === "react-dom/server.node" ||
    request === "react-server-dom-webpack/client.node"
  ) {
    return clientEnvironment;
  }
  return environmentId;
}

function resolveProjectPath(root, value) {
  if (!value) return undefined;
  return path.isAbsolute(value) ? value : path.join(root, value);
}
