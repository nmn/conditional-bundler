import fs from "node:fs";

export default function environmentIndependentBabelPlugin() {
  return {
    name: "environment-independent-babel-plugin",
    visitor: {
      Program(_path, state) {
        if (!state.opts.filePath.endsWith("shared.js")) {
          return;
        }
        if (state.opts.envId !== undefined) {
          throw new Error(
            `Shared transform unexpectedly received env '${state.opts.envId}' in ${JSON.stringify(state.opts.envs)} at '${state.opts.filePath}'.`,
          );
        }
        if (state.opts.countFile) {
          fs.appendFileSync(state.opts.countFile, "shared\n");
        }
      },
    },
  };
}
