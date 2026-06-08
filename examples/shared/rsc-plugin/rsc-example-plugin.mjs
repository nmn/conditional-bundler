import { createRequire } from "node:module";
import path from "node:path";

const externalPrefixes = [
  "node:",
  "react",
  "react/",
  "react-dom",
  "react-dom/",
  "react-server-dom-webpack",
  "react-server-dom-webpack/",
];

export default function rscExamplePlugin(options) {
  return createRscExamplePlugin(options);
}

export function createRscExamplePlugin(options) {
  const root = options.root;
  if (!root) {
    throw new Error("rscExamplePlugin requires a project root.");
  }
  const requireFromRoot = createRequire(`${root}/package.json`);
  const clientEnv = options.clientEnv ?? options.client?.env ?? "client";
  const rscEnv = options.rscEnv ?? options.server?.env ?? "rsc";
  const clientManifestFile =
    options.clientManifestFile ??
    options.client?.manifestFile ??
    "rsc-client-manifest.json";
  const clientEntry = resolveProjectPath(
    root,
    options.clientEntry ?? options.client?.entry ?? "src/client.jsx",
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
    },
    resolveImport: async ({ request }) =>
      externalPrefixes.some(
        (prefix) => request === prefix || request.startsWith(prefix),
      )
        ? null
        : undefined,
    transform: {
      default: [
        [
          requireFromRoot.resolve("@babel/plugin-transform-react-jsx"),
          jsxOptions,
        ],
        ["./rsc-transform-babel-plugin.mjs", { root, clientEnv, rscEnv }],
      ],
    },
    buildEnd({ manifest, modules, emitFile }) {
      const clientBundles = new Map(
        manifest.bundles
          .filter((bundle) => bundle.envId === clientEnv)
          .flatMap((bundle) =>
            bundle.modules.map((moduleId) => [moduleId, bundle.fileName]),
          ),
      );
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
        const fileName = clientBundles.get(moduleRecord.id);
        if (!fileName) {
          continue;
        }
        for (const exportName of metadata.exports ?? []) {
          const symbolName = findExportSymbol(moduleRecord, exportName);
          records[`${metadata.clientId}#${exportName}`] = {
            id: fileName,
            name: symbolName,
            chunks: [fileName, fileName],
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

function findExportSymbol(moduleRecord, exportName) {
  const local =
    moduleRecord.exportsLocal?.find((item) => item.exported === exportName)
      ?.local ?? exportName;
  return `${moduleRecord.prefix}_${local}`;
}
