export default function sourceMapShiftBabelPlugin({ types }) {
  return {
    name: "source-map-shift-babel-plugin",
    visitor: {
      Program(path) {
        path.unshiftContainer(
          "body",
          types.expressionStatement(
            types.unaryExpression("void", types.stringLiteral("map-stage")),
          ),
        );
      },
    },
  };
}
