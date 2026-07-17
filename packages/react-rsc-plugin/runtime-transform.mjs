import path from "node:path";

export default function reactRscRuntimeBabelPlugin(api, options) {
  const t = api.types;
  return {
    name: "react-rsc-runtime-template",
    visitor: {
      Program(programPath, state) {
        const filePath = options.filePath ?? state.filename;
        if (
          !options.runtimeTemplatePath ||
          path.resolve(filePath) !== path.resolve(options.runtimeTemplatePath)
        ) {
          return;
        }
        programPath.traverse({
          StringLiteral(literalPath) {
            if (literalPath.node.value === "__BUNDLER_RSC_ENDPOINT__") {
              literalPath.node.value = options.rscEndpoint ?? "/rsc";
            }
          },
        });
        if (!options.clientReferenceEntry) {
          return;
        }
        let request = path
          .relative(path.dirname(filePath), options.clientReferenceEntry)
          .split(path.sep)
          .join("/");
        if (!request.startsWith(".")) request = `./${request}`;
        programPath.node.body.unshift(
          t.exportAllDeclaration(t.stringLiteral(request)),
        );
      },
    },
  };
}
