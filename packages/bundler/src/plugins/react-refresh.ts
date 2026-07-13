import type { BundlerPlugin } from "./types.js";

export default function reactRefreshPlugin(options: {
  envs?: string[];
}): BundlerPlugin {
  const envs = options.envs ?? [];
  return {
    name: "builtin-react-refresh",
    transformPost: Object.fromEntries(
      envs.map((envId) => [
        envId,
        [
          [
            "react-refresh/babel",
            {
              skipEnvCheck: true,
              __bundlerExcludeNodeModules: true,
            },
          ],
        ],
      ]),
    ),
  };
}
