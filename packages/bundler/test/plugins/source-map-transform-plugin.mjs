export default function sourceMapTransformPlugin() {
  return {
    name: "source-map-transform-plugin",
    transformPre: ["./source-map-shift-babel-plugin.mjs"],
    transformPost: ["./source-map-shift-babel-plugin.mjs"],
  };
}
