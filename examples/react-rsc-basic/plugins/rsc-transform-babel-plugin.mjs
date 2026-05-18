import path from "node:path";

export default function rscTransformBabelPlugin(api, options) {
  const t = api.types;
  const root = options.root;
  const rscEnv = options.rscEnv ?? "rsc";
  const clientEnv = options.clientEnv ?? "client";

  return {
    name: "react-rsc-basic-transform",
    visitor: {
      Program(programPath, state) {
        const filePath = options.filePath ?? state.filename;
        const clientId = normalizeClientId(root, filePath);
        const hasUseClient = programPath.node.directives.some(
          (directive) => directive.value.value === "use client",
        );

        if (!hasUseClient) {
          return;
        }

        const exports = collectExports(programPath.node.body, t);
        state.file.metadata.conditionalBundlerDiscoveredEntrypoints = [
          {
            id: clientId,
            request: `./${path.basename(filePath)}`,
            envs: [clientEnv],
          },
        ];
        state.file.metadata.conditionalBundlerExtraOutputs = {
          "rsc-client-reference": {
            contents: JSON.stringify({ clientId, exports }, null, 2),
            metadata: { clientId, exports },
          },
        };

        if (options.envId !== rscEnv) {
          return;
        }

        const body = [];

        for (const exportName of exports) {
          const localName =
            exportName === "default"
              ? "__rsc_default__"
              : `__rsc_${exportName}`;
          body.push(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier(localName),
                t.callExpression(t.identifier("__registerClientReference"), [
                  t.functionExpression(
                    exportName === "default" ? null : t.identifier(exportName),
                    [],
                    t.blockStatement([
                      t.throwStatement(
                        t.newExpression(t.identifier("Error"), [
                          t.stringLiteral(
                            "Client references cannot be called on the server.",
                          ),
                        ]),
                      ),
                    ]),
                  ),
                  t.stringLiteral(clientId),
                  t.stringLiteral(exportName),
                ]),
              ),
            ]),
          );
          body.push(
            exportName === "default"
              ? t.exportDefaultDeclaration(t.identifier(localName))
              : t.exportNamedDeclaration(null, [
                  t.exportSpecifier(
                    t.identifier(localName),
                    t.identifier(exportName),
                  ),
                ]),
          );
        }

        programPath.node.directives = [];
        programPath.node.body = body;
      },
    },
  };
}

function normalizeClientId(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function collectExports(body, t) {
  const exports = new Set();
  for (const statement of body) {
    if (t.isExportDefaultDeclaration(statement)) {
      exports.add("default");
      continue;
    }
    if (!t.isExportNamedDeclaration(statement)) {
      continue;
    }
    if (statement.declaration) {
      collectDeclarationExports(statement.declaration, exports, t);
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (t.isExportSpecifier(specifier)) {
        exports.add(
          t.isIdentifier(specifier.exported)
            ? specifier.exported.name
            : specifier.exported.value,
        );
      }
    }
  }
  return Array.from(exports);
}

function collectDeclarationExports(declaration, exports, t) {
  if (
    (t.isFunctionDeclaration(declaration) ||
      t.isClassDeclaration(declaration)) &&
    declaration.id
  ) {
    exports.add(declaration.id.name);
    return;
  }
  if (!t.isVariableDeclaration(declaration)) {
    return;
  }
  for (const item of declaration.declarations) {
    if (t.isIdentifier(item.id)) {
      exports.add(item.id.name);
    }
  }
}
