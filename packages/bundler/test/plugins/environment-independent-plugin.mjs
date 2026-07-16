export default function environmentIndependentPlugin() {
  return {
    name: "environment-independent-plugin",
    transform: [
      [
        "./environment-independent-babel-plugin.mjs",
        {
          __bundlerEnvironmentIndependent: true,
        },
      ],
    ],
  };
}
