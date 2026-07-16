export default function metadataOutputBabelPlugin() {
  return {
    name: "metadata-output-babel-plugin",
    visitor: {
      Program(_path, state) {
        state.file.metadata.conditionalBundlerExtraOutputs = {
          "test-metadata": {
            type: "test-json",
            contents: JSON.stringify({
              envId: state.opts.envId,
              moduleIdentity: state.opts.moduleIdentity,
            }),
            metadata: {
              envId: state.opts.envId,
              moduleIdentity: state.opts.moduleIdentity,
            },
          },
        };
      },
    },
  };
}
