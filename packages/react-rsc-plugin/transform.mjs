import path from "node:path";

export default function reactRscTransformBabelPlugin(api, options) {
  const t = api.types;
  const root = options.root;
  const serverEnvironment =
    options.serverEnvironment ?? options.rscEnvironment ?? "react.server";
  const clientEnvironment = options.clientEnvironment ?? "react.client";
  const serverTarget = options.serverTarget ?? "server";
  const clientTarget = options.clientTarget ?? "client";

  return {
    name: "react-rsc-transform",
    visitor: {
      Program(programPath, state) {
        const filePath = options.filePath ?? state.filename;
        const clientId = normalizeClientId(root, filePath);
        const hasUseClient = programPath.node.directives.some(
          (directive) => directive.value.value === "use client",
        );

        if (!hasUseClient || options.environmentId !== serverEnvironment) {
          return;
        }

        const exports = collectExports(programPath.node.body, t);
        const selfRequest = `./${path.basename(filePath)}`;
        const clientChunksLocal = "__rsc_client_chunks__";
        const ssrChunksLocal = "__rsc_ssr_chunks__";
        const registerLocal = "__rsc_registerClientReference__";
        const implementationLocal = "__rsc_createClientImplementation__";
        const body = [
          createChunkImport(
            clientChunksLocal,
            selfRequest,
            "rsc-client-chunks",
            clientEnvironment,
            clientTarget,
            "public",
            t,
          ),
          createChunkImport(
            ssrChunksLocal,
            selfRequest,
            "rsc-ssr-chunks",
            clientEnvironment,
            serverTarget,
            "module-relative",
            t,
          ),
          t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier(registerLocal),
                t.identifier("registerClientReference"),
              ),
              t.importSpecifier(
                t.identifier(implementationLocal),
                t.identifier("createClientImplementation"),
              ),
            ],
            t.stringLiteral("@bundler/react-server-dom/server"),
          ),
        ];

        for (const exportName of exports) {
          const localName =
            exportName === "default"
              ? "__rsc_default__"
              : `__rsc_${exportName}`;
          const implementation = t.callExpression(
            t.identifier(implementationLocal),
            [t.identifier(ssrChunksLocal), t.stringLiteral(exportName)],
          );
          body.push(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier(localName),
                t.callExpression(t.identifier(registerLocal), [
                  implementation,
                  t.stringLiteral(clientId),
                  t.stringLiteral(exportName),
                  t.identifier(clientChunksLocal),
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

function createChunkImport(
  localName,
  request,
  representation,
  environment,
  target,
  urlMode,
  t,
) {
  const declaration = t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier(localName))],
    t.stringLiteral(request),
  );
  declaration.attributes = [
    t.importAttribute(t.identifier("as"), t.stringLiteral(representation)),
    t.importAttribute(
      t.identifier("environment"),
      t.stringLiteral(environment),
    ),
    t.importAttribute(t.identifier("target"), t.stringLiteral(target)),
    t.importAttribute(t.identifier("urlMode"), t.stringLiteral(urlMode)),
  ];
  return declaration;
}

function normalizeClientId(root, filePath) {
  return `/${path.relative(root, filePath).split(path.sep).join("/")}`;
}

function collectExports(body, t) {
  const exports = new Set();
  for (const statement of body) {
    if (t.isExportDefaultDeclaration(statement)) {
      exports.add("default");
      continue;
    }
    if (!t.isExportNamedDeclaration(statement)) continue;
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
  if (!t.isVariableDeclaration(declaration)) return;
  for (const item of declaration.declarations) {
    if (t.isIdentifier(item.id)) exports.add(item.id.name);
  }
}
