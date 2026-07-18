export default function environmentTargetBabelPlugin(api) {
  const t = api.types;

  return {
    name: "environment-target-test-transform",
    visitor: {
      Identifier(identifierPath, state) {
        if (
          identifierPath.node.name !== "__TRANSFORM_ENVIRONMENT__" ||
          !identifierPath.isReferencedIdentifier() ||
          identifierPath.scope.hasBinding("__TRANSFORM_ENVIRONMENT__")
        ) {
          return;
        }
        identifierPath.replaceWith(
          t.stringLiteral(state.opts.environmentId ?? "shared"),
        );
      },
    },
  };
}
