import transformTypeScriptModule from "@babel/plugin-transform-typescript";

const transformTypeScript =
  transformTypeScriptModule.default ?? transformTypeScriptModule;

export default function typescriptTransformPlugin(api, options = {}) {
  if (options.syntax?.ts !== true) {
    return { name: "typescript-plugin" };
  }

  const transform = transformTypeScript(api, {
    allowDeclareFields: true,
  });
  if (options.syntax.jsx !== true) {
    return transform;
  }

  return {
    ...transform,
    manipulateOptions(_babelOptions, parserOptions) {
      if (
        !parserOptions.plugins.some((plugin) =>
          Array.isArray(plugin) ? plugin[0] === "jsx" : plugin === "jsx",
        )
      ) {
        parserOptions.plugins.push("jsx");
      }
    },
  };
}
