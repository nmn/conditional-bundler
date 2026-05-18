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
  const root = options.root;
  const clientEnv = options.clientEnv ?? "client";
  const rscEnv = options.rscEnv ?? "rsc";
  const clientManifestFile =
    options.clientManifestFile ?? "rsc-client-manifest.json";
  const clientEntry = options.clientEntry;

  return {
    name: "react-rsc-basic",
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
          "@babel/plugin-transform-react-jsx",
          { runtime: "automatic", importSource: "react" },
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
          records[`${metadata.clientId}#${exportName}`] = {
            id: fileName,
            name: exportName,
            chunks: [fileName],
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
