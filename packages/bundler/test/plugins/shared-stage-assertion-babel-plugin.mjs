export default function sharedStageAssertionBabelPlugin() {
  return {
    name: "shared-stage-assertion-babel-plugin",
    visitor: {
      Program(_path, state) {
        if (state.opts.envId !== undefined) {
          throw new Error(
            `Shared stage received unexpected environment '${state.opts.envId}'.`,
          );
        }
      },
    },
  };
}
