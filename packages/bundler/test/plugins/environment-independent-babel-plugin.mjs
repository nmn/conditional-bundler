export default function environmentIndependentBabelPlugin() {
  return {
    name: "environment-independent-babel-plugin",
    visitor: {
      Program(_path, state) {
        if (
          state.opts.filePath.endsWith("shared.js") &&
          state.opts.envId !== "server"
        ) {
          throw new Error(
            `Environment-independent transform ran again for '${state.opts.envId}' in ${JSON.stringify(state.opts.envs)} at '${state.opts.filePath}'.`,
          );
        }
      },
    },
  };
}
