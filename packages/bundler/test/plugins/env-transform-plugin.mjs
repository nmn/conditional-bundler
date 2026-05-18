export default function envTransformPlugin(options = {}) {
  return {
    name: "env-transform-plugin",
    transform: {
      default: [
        [
          "./string-replace-babel-plugin.mjs",
          { from: "__TOKEN__", to: options.defaultValue ?? "server" },
        ],
      ],
      client: [
        [
          "./string-replace-babel-plugin.mjs",
          {
            from: options.defaultValue ?? "server",
            to: options.clientValue ?? "client",
          },
        ],
      ],
    },
  };
}
