export default function stringReplaceBabelPlugin({ types: t }) {
  return {
    name: "string-replace-babel-plugin",
    visitor: {
      StringLiteral(path, state) {
        if (path.node.value === state.opts.from) {
          path.replaceWith(t.stringLiteral(state.opts.to));
        }
      },
    },
  };
}
