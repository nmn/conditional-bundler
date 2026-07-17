export default function environmentIndependentPlugin(options = {}) {
  return {
    name: "environment-independent-plugin",
    transform: [
      [
        "./environment-independent-babel-plugin.mjs",
        { countFile: options.countFile },
      ],
    ],
  };
}
