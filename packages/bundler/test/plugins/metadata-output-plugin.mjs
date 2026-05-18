export default function metadataOutputPlugin() {
  return {
    name: "metadata-output-plugin",
    transform: ["./metadata-output-babel-plugin.mjs"],
    buildEnd({ modules, emitFile }) {
      const outputs = modules
        .flatMap((moduleRecord) =>
          Object.entries(moduleRecord.extraOutputs ?? {}).map(
            ([name, output]) => ({
              name,
              file: moduleRecord.filePath,
              contents: output.contents,
            }),
          ),
        )
        .sort((left, right) => left.file.localeCompare(right.file));
      emitFile({
        fileName: "extra-outputs.json",
        contents: JSON.stringify(outputs, null, 2),
        type: "manifest",
      });
    },
  };
}
