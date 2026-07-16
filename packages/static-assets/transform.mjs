import crypto from "node:crypto";

export default function staticAssetBabelPlugin(api) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "static-assets",
    visitor: {
      Program: {
        enter(programPath) {
          programPath.setData("bundlerAssetImports", new Map());
        },
        exit(programPath) {
          const imports = programPath.getData("bundlerAssetImports");
          if (!imports || imports.size === 0) {
            return;
          }
          programPath.unshiftContainer(
            "body",
            Array.from(imports.entries()).map(([request, identifier]) =>
              t.importDeclaration(
                [t.importDefaultSpecifier(t.cloneNode(identifier))],
                t.stringLiteral(request),
              ),
            ),
          );
        },
      },
      NewExpression(newPath, state) {
        if (
          !t.isIdentifier(newPath.node.callee, { name: "URL" }) ||
          newPath.scope.hasBinding("URL") ||
          newPath.node.arguments.length !== 2 ||
          !t.isStringLiteral(newPath.node.arguments[0]) ||
          !isImportMetaUrl(newPath.node.arguments[1], t)
        ) {
          return;
        }
        const request = newPath.node.arguments[0].value;
        if (!isLocalRequest(request)) {
          return;
        }
        const programPath = newPath.findParent((item) => item.isProgram());
        const imports = programPath.getData("bundlerAssetImports");
        let identifier = imports.get(request);
        if (!identifier) {
          const moduleIdentity = state.opts?.moduleIdentity ?? "module";
          const digest = crypto
            .createHash("sha1")
            .update(`${moduleIdentity}\0${request}`)
            .digest("hex")
            .slice(0, 10);
          identifier = programPath.scope.generateUidIdentifier(
            `bundler_asset_${digest}`,
          );
          imports.set(request, identifier);
        }
        const replacement = t.newExpression(t.identifier("URL"), [
          t.memberExpression(t.cloneNode(identifier), t.identifier("src")),
          t.cloneNode(newPath.node.arguments[1]),
        ]);
        replacement.loc = newPath.node.loc;
        newPath.replaceWith(replacement);
      },
    },
  };
}

function isImportMetaUrl(node, t) {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property, { name: "url" }) &&
    t.isMetaProperty(node.object) &&
    t.isIdentifier(node.object.meta, { name: "import" }) &&
    t.isIdentifier(node.object.property, { name: "meta" })
  );
}

function isLocalRequest(request) {
  return !/^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/|#)/.test(request);
}
