import fs from "node:fs";
import path from "node:path";

export default function introducedImportBabelPlugin({ types: t }) {
  return {
    name: "introduced-import-babel-plugin",
    visitor: {
      Program(programPath, state) {
        if (path.basename(state.opts.filePath) !== "index.js") {
          return;
        }
        if (state.opts.countFile) {
          fs.appendFileSync(state.opts.countFile, "transform\n");
        }
        if (
          programPath.node.body.some(
            (statement) =>
              t.isImportDeclaration(statement) &&
              statement.source.value === "./dependency.js",
          )
        ) {
          return;
        }
        programPath.unshiftContainer(
          "body",
          t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier("injected"),
                t.identifier("injected"),
              ),
            ],
            t.stringLiteral("./dependency.js"),
          ),
        );
      },
    },
  };
}
