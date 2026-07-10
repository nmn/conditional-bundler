export default function introducedImportPlugin() {
  return {
    name: "introduced-import-plugin",
    transform: {
      default: ["./introduced-import-babel-plugin.mjs"],
    },
  };
}
