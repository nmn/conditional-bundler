export default function metadataOutputBabelPlugin() {
  return {
    name: "metadata-output-babel-plugin",
    visitor: {
      Program(_path, state) {
        state.file.metadata.conditionalBundlerExtraOutputs = {
          "test-metadata": {
            contents: JSON.stringify({
              envId: state.opts.envId,
              filePath: state.opts.filePath,
            }),
            metadata: {
              envId: state.opts.envId,
              filePath: state.opts.filePath,
            },
          },
        };
      },
    },
  };
}
