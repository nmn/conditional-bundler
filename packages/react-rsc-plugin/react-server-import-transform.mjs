const aliases = new Map([
  ["react", "react-server"],
  ["react/jsx-runtime", "react-server/jsx-runtime"],
  ["react/jsx-dev-runtime", "react-server/jsx-dev-runtime"],
]);

export default function reactServerImportTransform(api, options) {
  const t = api.types;
  const useClientReact =
    options.reactCjsEnv === (options.clientEnvironment ?? "react.client");
  const rewriteRequires = options.rewriteRequires !== false;
  const rewrite = (literal) => {
    if (useClientReact) return;
    const next = aliases.get(literal.value);
    if (next) literal.value = next;
  };
  const traverseProgram = (programPath) => {
    programPath.traverse({
      ImportDeclaration(importPath) {
        rewrite(importPath.node.source);
      },
      ExportNamedDeclaration(exportPath) {
        if (exportPath.node.source) rewrite(exportPath.node.source);
      },
      ExportAllDeclaration(exportPath) {
        rewrite(exportPath.node.source);
      },
      CallExpression(callPath) {
        if (
          rewriteRequires &&
          t.isIdentifier(callPath.node.callee, { name: "require" }) &&
          callPath.node.arguments.length === 1 &&
          t.isStringLiteral(callPath.node.arguments[0])
        ) {
          rewrite(callPath.node.arguments[0]);
        }
      },
    });
  };
  return {
    name: "bundler-react-server-imports",
    visitor: {
      Program: rewriteRequires
        ? {
            // The pre-transform instance must run before CommonJS dependency
            // analysis in the shared Babel compilation.
            enter: traverseProgram,
          }
        : {
            // JSX lowering adds runtime imports during traversal, so the
            // finalize instance rewrites them only after every source visitor.
            exit: traverseProgram,
          },
    },
  };
}
