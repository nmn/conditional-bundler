export default function introducedImportPlugin(options = {}) {
  return {
    name: "introduced-import-plugin",
    transform: {
      default: [
        [
          "./introduced-import-babel-plugin.mjs",
          { countFile: options.countFile },
        ],
      ],
    },
  };
}
