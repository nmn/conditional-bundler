export default function throwOnEnvBabelPlugin() {
  return {
    visitor: {
      Program() {
        if (process.env.BUNDLER_THROW_TRANSFORM === "1") {
          throw new Error("transform ran");
        }
      },
    },
  };
}
