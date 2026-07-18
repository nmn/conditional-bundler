const representation = "url_and_deps_array";

export default function dynamicImportsBabelPlugin(api) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "dynamic-imports-as-url-and-deps-array",
    visitor: {
      Program: {
        enter(programPath) {
          const imports = new Map();
          for (const statement of programPath.node.body) {
            if (!t.isImportDeclaration(statement)) continue;
            if (readAttribute(statement, "as", t) !== representation) continue;
            const defaultSpecifier = statement.specifiers.find((specifier) =>
              t.isImportDefaultSpecifier(specifier),
            );
            if (defaultSpecifier) {
              imports.set(statement.source.value, {
                urls: defaultSpecifier.local,
              });
            }
          }
          programPath.setData("bundlerDynamicImports", imports);
        },
        exit(programPath) {
          const imports =
            programPath.getData("bundlerGeneratedDynamicImports") ?? [];
          const loaders =
            programPath.getData("bundlerGeneratedDynamicLoaders") ?? [];
          if (imports.length === 0 && loaders.length === 0) return;
          programPath.unshiftContainer("body", [...imports, ...loaders]);
        },
      },
      CallExpression(callPath) {
        if (
          !t.isImport(callPath.node.callee) ||
          callPath.node.arguments.length !== 1 ||
          !t.isStringLiteral(callPath.node.arguments[0])
        ) {
          return;
        }
        const request = callPath.node.arguments[0].value;
        if (!isBundledRequest(request)) return;

        const programPath = callPath.findParent((item) => item.isProgram());
        const imports = programPath.getData("bundlerDynamicImports");
        let dynamicImport = imports.get(request);
        if (!dynamicImport) {
          const urls = programPath.scope.generateUidIdentifier(
            "bundler_dynamic_urls",
          );
          dynamicImport = { urls };
          imports.set(request, dynamicImport);
          const declarations =
            programPath.getData("bundlerGeneratedDynamicImports") ?? [];
          const declaration = t.importDeclaration(
            [t.importDefaultSpecifier(t.cloneNode(urls))],
            t.stringLiteral(request),
          );
          declaration.attributes = [createAttribute("as", representation, t)];
          declarations.push(declaration);
          programPath.setData("bundlerGeneratedDynamicImports", declarations);
        }
        if (!dynamicImport.loader) {
          dynamicImport.loader = programPath.scope.generateUidIdentifier(
            "bundler_dynamic_import",
          );
          const loaders =
            programPath.getData("bundlerGeneratedDynamicLoaders") ?? [];
          loaders.push(
            createLoaderDeclaration(
              dynamicImport.loader,
              dynamicImport.urls,
              programPath,
              t,
            ),
          );
          programPath.setData("bundlerGeneratedDynamicLoaders", loaders);
        }
        callPath.replaceWith(
          t.callExpression(t.cloneNode(dynamicImport.loader), []),
        );
      },
    },
  };
}

function createLoaderDeclaration(loader, urls, programPath, t) {
  const url = programPath.scope.generateUidIdentifier(
    "bundler_dynamic_dependency_url",
  );
  const modules = programPath.scope.generateUidIdentifier(
    "bundler_dynamic_modules",
  );
  return t.variableDeclaration("const", [
    t.variableDeclarator(
      t.cloneNode(loader),
      t.arrowFunctionExpression(
        [],
        t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(t.identifier("Promise"), t.identifier("all")),
              [
                t.callExpression(
                  t.memberExpression(t.cloneNode(urls), t.identifier("map")),
                  [
                    t.arrowFunctionExpression(
                      [t.cloneNode(url)],
                      t.callExpression(t.import(), [t.cloneNode(url)]),
                    ),
                  ],
                ),
              ],
            ),
            t.identifier("then"),
          ),
          [
            t.arrowFunctionExpression(
              [t.cloneNode(modules)],
              t.memberExpression(
                t.cloneNode(modules),
                t.numericLiteral(0),
                true,
              ),
            ),
          ],
        ),
      ),
    ),
  ]);
}

function isBundledRequest(request) {
  return request.startsWith(".") || request.startsWith("/");
}

function createAttribute(key, value, t) {
  return t.importAttribute(t.identifier(key), t.stringLiteral(value));
}

function readAttribute(node, key, t) {
  return (node.attributes ?? node.assertions ?? []).find(
    (attribute) =>
      t.isImportAttribute(attribute) &&
      readAttributeKey(attribute, t) === key &&
      t.isStringLiteral(attribute.value),
  )?.value.value;
}

function readAttributeKey(attribute, t) {
  return t.isIdentifier(attribute.key)
    ? attribute.key.name
    : t.isStringLiteral(attribute.key)
      ? attribute.key.value
      : undefined;
}
