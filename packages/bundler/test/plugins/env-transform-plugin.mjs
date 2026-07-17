export default function envTransformPlugin(options = {}) {
  return {
    name: "env-transform-plugin",
    transform: [
      [
        "./string-replace-babel-plugin.mjs",
        { from: "__TOKEN__", to: options.defaultValue ?? "server" },
      ],
      {
        plugin: [
          "./string-replace-babel-plugin.mjs",
          {
            from: options.defaultValue ?? "server",
            to: options.clientValue ?? "client",
          },
        ],
        environments: ["client"],
      },
      ["./shared-stage-assertion-babel-plugin.mjs", {}],
    ],
  };
}
