import path from "node:path";
import { parse } from "@babel/parser";

const browserPrelude = `
const __bundler_rsc_runtime__ = globalThis.__BUNDLER_RSC_CLIENT_RUNTIME__ ??= {
  moduleCache: new Map(),
  urlCache: new Map(),
  update(id, module) {
    this.moduleCache.set(id, module);
  }
};
const __bundler_rsc_module_cache__ = __bundler_rsc_runtime__.moduleCache;
const __bundler_rsc_url_cache__ = __bundler_rsc_runtime__.urlCache;
`;

const browserFunctions = {
  requireAsyncModule: `
    function requireAsyncModule() {
      return null;
    }
  `,
  preloadModule: `
    function preloadModule(metadata) {
      var urls = metadata[1];
      var promises = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const isEntry = i === 0;
        let cached = __bundler_rsc_url_cache__.get(url);
        if (cached === undefined) {
          cached = import(url).then(function(module) {
            __bundler_rsc_url_cache__.set(url, module);
            if (isEntry) {
              __bundler_rsc_module_cache__.set(metadata[0], module);
            }
            return module;
          });
          __bundler_rsc_url_cache__.set(url, cached);
          promises.push(cached);
        } else if (typeof cached.then === "function") {
          if (isEntry) {
            promises.push(cached.then(function(module) {
              __bundler_rsc_module_cache__.set(metadata[0], module);
              return module;
            }));
          } else {
            promises.push(cached);
          }
        } else if (isEntry) {
          __bundler_rsc_module_cache__.set(metadata[0], cached);
        }
      }
      return promises.length === 0 ? null : Promise.all(promises);
    }
  `,
  requireModule: `
    function requireModule(metadata) {
      var moduleExports = __bundler_rsc_module_cache__.get(metadata[0]);
      if (!moduleExports) {
        throw new Error("RSC Client Component was not preloaded: " + metadata[0]);
      }
      if (metadata[2] === "*") return moduleExports;
      if (metadata[2] === "") return moduleExports.default;
      return moduleExports[metadata[2]];
    }
  `,
};

const nodeFunctions = {
  requireAsyncModule: `
    function requireAsyncModule() {
      return null;
    }
  `,
  preloadModule: `
    function preloadModule(metadata) {
      return __bundler_preload_client_implementation__(metadata[0], metadata[2]);
    }
  `,
  requireModule: `
    function requireModule(metadata) {
      return __bundler_require_client_implementation__(metadata[0], metadata[2]);
    }
  `,
};

export default function inlineRscRuntimeTransform(api) {
  const t = api.types;
  return {
    name: "bundler-inline-rsc-runtime",
    visitor: {
      Program: {
        exit(programPath, state) {
          const filePath = state.opts.filePath ?? state.filename;
          const baseName = path.basename(filePath);
          const browser = baseName.startsWith(
            "react-server-dom-webpack-client.browser.",
          );
          const node =
            baseName.startsWith("react-server-dom-webpack-client.node.") ||
            baseName.startsWith("react-server-dom-webpack-server.node.");
          if (!browser && !node) return;

          const replacements = browser ? browserFunctions : nodeFunctions;
          programPath.traverse({
            FunctionDeclaration(functionPath) {
              const name = functionPath.node.id?.name;
              if (browser && name === "loadChunk") {
                functionPath.remove();
                return;
              }
              const source = name ? replacements[name] : undefined;
              if (source) {
                const replacement = parse(source, {
                  sourceType: "module",
                }).program.body[0];
                functionPath.replaceWith(t.removePropertiesDeep(replacement));
                functionPath.skip();
                return;
              }
              if (browser && name === "resolveModuleChunk") {
                functionPath.scope.rename("chunkId", "chunkUrl");
                functionPath.traverse({
                  ExpressionStatement(statementPath) {
                    const expression = statementPath.node.expression;
                    if (
                      t.isMemberExpression(expression, {
                        computed: true,
                      }) &&
                      t.isIdentifier(expression.object, { name: "value" }) &&
                      t.isUpdateExpression(expression.property, {
                        operator: "++",
                        prefix: false,
                      }) &&
                      t.isIdentifier(expression.property.argument, {
                        name: "i",
                      })
                    ) {
                      statementPath.remove();
                    }
                  },
                  ObjectProperty(propertyPath) {
                    if (
                      t.isIdentifier(propertyPath.node.key, {
                        name: "chunkId",
                      }) &&
                      t.isIdentifier(propertyPath.node.value, {
                        name: "chunkUrl",
                      })
                    ) {
                      propertyPath.node.key = t.identifier("chunkUrl");
                    }
                  },
                });
              }
            },
            VariableDeclaration(declarationPath) {
              if (!browser) return;
              declarationPath.node.declarations =
                declarationPath.node.declarations.filter(
                  (declaration) =>
                    !(
                      t.isIdentifier(declaration.id) &&
                      (declaration.id.name === "chunkMap" ||
                        declaration.id.name === "webpackGetChunkFilename")
                    ),
                );
              if (declarationPath.node.declarations.length === 0) {
                declarationPath.remove();
              }
            },
            AssignmentExpression(assignmentPath) {
              if (
                browser &&
                t.isMemberExpression(assignmentPath.node.left) &&
                t.isIdentifier(assignmentPath.node.left.object, {
                  name: "__webpack_require__",
                }) &&
                t.isIdentifier(assignmentPath.node.left.property, {
                  name: "u",
                })
              ) {
                assignmentPath.parentPath.remove();
              }
            },
            CallExpression(callPath) {
              if (
                browser &&
                t.isIdentifier(callPath.node.callee, {
                  name: "__webpack_get_script_filename__",
                }) &&
                callPath.node.arguments.length === 1 &&
                t.isExpression(callPath.node.arguments[0])
              ) {
                callPath.replaceWith(t.cloneNode(callPath.node.arguments[0]));
              }
            },
          });

          const unsupportedGlobals = [];
          programPath.traverse({
            Identifier(identifierPath) {
              if (
                identifierPath.node.name === "__webpack_require__" ||
                identifierPath.node.name === "__webpack_chunk_load__" ||
                identifierPath.node.name === "__webpack_get_script_filename__"
              ) {
                unsupportedGlobals.push(identifierPath.node.name);
              }
            },
          });
          if (unsupportedGlobals.length > 0) {
            throw new Error(
              `Pinned RSC runtime still contains unsupported Webpack globals: ${Array.from(new Set(unsupportedGlobals)).join(", ")}`,
            );
          }

          if (browser) {
            programPath.unshiftContainer(
              "body",
              parse(browserPrelude, { sourceType: "module" }).program.body.map(
                (node) => t.removePropertiesDeep(node),
              ),
            );
          } else {
            programPath.unshiftContainer(
              "body",
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier("__bundler_preload_client_implementation__"),
                    t.identifier("preloadClientImplementation"),
                  ),
                  t.importSpecifier(
                    t.identifier("__bundler_require_client_implementation__"),
                    t.identifier("requireClientImplementation"),
                  ),
                ],
                t.stringLiteral(
                  "@bundler/react-server-dom/implementation-registry",
                ),
              ),
            );
          }
        },
      },
    },
  };
}
