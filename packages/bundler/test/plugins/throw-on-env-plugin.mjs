export default function throwOnEnvPlugin() {
  return {
    name: "throw-on-env-plugin",
    transform: ["./throw-on-env-babel-plugin.mjs"],
  };
}
