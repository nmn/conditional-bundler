export default function introducedImportPlugin(options = {}) {
  return {
    name: "introduced-import-plugin",
    transform: [
      [
        "./introduced-import-babel-plugin.mjs",
        { countFile: options.countFile },
      ],
    ],
  };
}
