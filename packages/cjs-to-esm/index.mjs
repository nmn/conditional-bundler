import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const packageIdentityCache = new Map();

const builtinRequests = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

export default function cjsToEsmBabelPlugin(api, options = {}) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "cjs-to-esm",
    parserOverride(code, parserOptions, parseSource) {
      if (options.format !== "commonjs") {
        return parseSource(code, parserOptions);
      }
      return parseSource(code, {
        ...parserOptions,
        sourceType: "script",
        allowReturnOutsideFunction: true,
      });
    },
    visitor: {
      Program(programPath, state) {
        const pluginOptions = state.opts ?? options;
        if (pluginOptions.format !== "commonjs") {
          return;
        }

        const filePath = pluginOptions.filePath;
        const envId =
          pluginOptions.reactCjsEnv ?? pluginOptions.envId ?? "default";
        const nodeEnv =
          pluginOptions.nodeEnv ??
          pluginOptions.mode ??
          pluginOptions.buildMode;
        if (typeof nodeEnv !== "string" || nodeEnv.length === 0) {
          throw new Error(
            "cjs-to-esm requires an explicit build mode from the bundler coordinator.",
          );
        }
        const mode = nodeEnv === "production" ? "production" : "development";
        const context = {
          t,
          filePath,
          moduleIdentity:
            pluginOptions.moduleIdentity ??
            createCjsModuleIdentity(filePath, pluginOptions.pkg),
          envId,
          mode,
          nodeEnv,
          linkReferences: [],
          linkModulePaths: pluginOptions.linkModulePaths === true,
        };

        const strategy = pluginOptions.strategy ?? "auto";
        if (strategy !== "auto" && strategy !== "compatibility") {
          throw new Error(
            `Invalid cjs-to-esm strategy '${strategy}'. Expected 'auto' or 'compatibility'.`,
          );
        }
        const conditional = createConditionalWrapper(programPath, context);
        const transformed = conditional
          ? { body: conditional, strategy: "conditional" }
          : strategy === "compatibility"
            ? {
                body: createCompatibilityWrapper(programPath, context),
                strategy: "compatibility",
              }
            : (createStaticEsmModule(programPath, context) ?? {
                body: createCompatibilityWrapper(programPath, context),
                strategy: "compatibility",
                fallbackReason:
                  programPath.getData("cjsToEsmFallbackReason") ??
                  "unsupported-commonjs",
              });
        programPath.node.sourceType = "module";
        programPath.node.interpreter = null;
        programPath.node.directives = [];
        programPath.node.body = transformed.body;
        state.file.metadata.cjsToEsm = {
          strategy: transformed.strategy,
          ...(transformed.fallbackReason
            ? { fallbackReason: transformed.fallbackReason }
            : {}),
        };
        if (context.linkReferences.length > 0) {
          const existing =
            state.file.metadata.conditionalBundlerLinkReferences ?? [];
          state.file.metadata.conditionalBundlerLinkReferences = [
            ...existing,
            ...context.linkReferences,
          ];
        }
      },
    },
  };
}

export { cjsToEsmBabelPlugin };

export function isNodeBuiltin(request) {
  return builtinRequests.has(request);
}

export function createCjsModuleIdentity(filePath, suppliedPackage) {
  const normalizedPath = toPosixPath(path.resolve(filePath));
  const suppliedIdentity = packageIdentityFromInfo(
    normalizedPath,
    suppliedPackage,
  );
  if (suppliedIdentity) {
    return suppliedIdentity;
  }

  let directory = path.dirname(filePath);
  while (true) {
    if (packageIdentityCache.has(directory)) {
      const cached = packageIdentityCache.get(directory);
      return cached
        ? packageIdentityFromInfo(normalizedPath, cached)
        : `anonymous@0.0.0::${path.posix.basename(normalizedPath)}`;
    }
    const manifestPath = path.join(directory, "package.json");
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const pkg = {
        name: manifest.name ?? "",
        version: manifest.version ?? "0.0.0",
        root: directory,
      };
      packageIdentityCache.set(directory, pkg);
      return packageIdentityFromInfo(normalizedPath, pkg);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      packageIdentityCache.set(directory, null);
      return `anonymous@0.0.0::${path.posix.basename(normalizedPath)}`;
    }
    directory = parent;
  }
}

function packageIdentityFromInfo(normalizedPath, pkg) {
  if (!pkg?.root) return null;
  const root = toPosixPath(path.resolve(pkg.root));
  const relativePath = path.posix.relative(root, normalizedPath);
  if (relativePath === ".." || relativePath.startsWith("../")) return null;
  return `${pkg.name ?? ""}@${pkg.version ?? "0.0.0"}::${relativePath || "."}`;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function isNodeEnvExpression(node, t) {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property, { name: "NODE_ENV" }) &&
    t.isMemberExpression(node.object) &&
    !node.object.computed &&
    t.isIdentifier(node.object.object, { name: "process" }) &&
    t.isIdentifier(node.object.property, { name: "env" })
  );
}

function walkAst(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "extra", "comments", "tokens"].includes(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) walkAst(item, visit);
    } else if (value && typeof value === "object") {
      walkAst(value, visit);
    }
  }
}

function readRequireRequest(node, t) {
  return t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: "require" }) &&
    node.arguments.length === 1 &&
    t.isStringLiteral(node.arguments[0])
    ? node.arguments[0].value
    : null;
}

function isModuleExportsNode(node, t) {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object, { name: "module" }) &&
    t.isIdentifier(node.property, { name: "exports" })
  );
}

function readExportTargetNode(node, t) {
  if (isModuleExportsNode(node, t)) {
    return { kind: "default" };
  }
  if (!t.isMemberExpression(node)) return null;
  const direct = t.isIdentifier(node.object, { name: "exports" });
  const throughModule = isModuleExportsNode(node.object, t);
  if (!direct && !throughModule) return null;
  const name = readMemberName(node, t);
  return name
    ? { kind: "named", name, target: direct ? "exports" : "module" }
    : null;
}

function isExportsDefinePropertyNode(node, t) {
  return (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object, { name: "Object" }) &&
    t.isIdentifier(node.callee.property, { name: "defineProperty" }) &&
    node.arguments.length >= 2 &&
    t.isIdentifier(node.arguments[0], { name: "exports" }) &&
    t.isStringLiteral(node.arguments[1])
  );
}

function readExportStarRequestNode(node, t) {
  if (
    !t.isCallExpression(node) ||
    !t.isIdentifier(node.callee, { name: "__exportStar" }) ||
    node.arguments.length !== 2 ||
    !t.isIdentifier(node.arguments[1], { name: "exports" })
  ) {
    return null;
  }
  return readRequireRequest(node.arguments[0], t);
}

function readObjectPropertyName(property) {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "StringLiteral") return property.key.value;
  return null;
}

function createStaticEsmModule(programPath, context) {
  const analysis = analyzeStaticCjs(programPath, context);
  if (!analysis.ok) {
    programPath.setData("cjsToEsmFallbackReason", analysis.reason);
    return null;
  }
  const { t } = context;
  const imports = createStaticImportManager(programPath, context);
  const exportedLocals = new Map();
  const directlyExportedBindings = new Set();
  const claimedExports = new Set([
    ...analysis.namedWrites.keys(),
    ...analysis.exportGetters.map((entry) => entry.name),
  ]);

  for (const processPath of analysis.processReads) {
    processPath.replaceWith(t.stringLiteral(context.mode));
  }

  for (const entry of analysis.exportStars) {
    for (const name of entry.names) {
      if (claimedExports.has(name) || name === "default") continue;
      const local = imports.ensureNamed(entry.request, name, entry.path.node);
      if (!local) continue;
      claimedExports.add(name);
      exportedLocals.set(name, local);
      entry.exports.push(
        t.exportSpecifier(t.cloneNode(local), t.identifier(name)),
      );
    }
    const replacements = entry.exports.length
      ? [t.exportNamedDeclaration(null, entry.exports)]
      : [];
    entry.statement.replaceWithMultiple(replacements);
  }

  programPath.scope.crawl();
  for (const requireEntry of analysis.requires) {
    const callPath = requireEntry.path;
    if (
      callPath.removed ||
      analysis.exportStarRequireNodes.has(callPath.node)
    ) {
      continue;
    }
    const parent = callPath.parentPath;
    if (parent?.isExpressionStatement()) {
      imports.ensureSideEffect(requireEntry.request, callPath.node);
      parent.remove();
      continue;
    }
    if (parent?.isVariableDeclarator() && parent.node.init === callPath.node) {
      if (parent.get("id").isObjectPattern()) {
        const converted = convertObjectPatternRequire(
          parent,
          requireEntry.request,
          imports,
          context,
        );
        if (converted) continue;
      }
      if (parent.get("id").isIdentifier()) {
        const converted = convertIdentifierRequire(
          parent,
          requireEntry.request,
          imports,
          context,
        );
        if (converted) continue;
      }
    }
    if (parent?.isMemberExpression() && parent.node.object === callPath.node) {
      const name = readMemberName(parent.node, t);
      if (name && name !== "default") {
        const local = imports.ensureNamed(
          requireEntry.request,
          name,
          callPath.node,
        );
        if (local) {
          parent.replaceWith(t.cloneNode(local));
          continue;
        }
      }
    }
    callPath.replaceWith(
      t.cloneNode(imports.ensureDefault(requireEntry.request, callPath.node)),
    );
  }

  const defaultFacadeBatch = readDefaultFacadeBatch(analysis, programPath, t);
  let defaultId = null;
  if (analysis.defaultWrite) {
    const right = analysis.defaultWrite.path.node.right;
    const declaration = defaultFacadeBatch
      ? t.exportDefaultDeclaration(
          t.callExpression(
            t.memberExpression(t.identifier("Object"), t.identifier("assign")),
            [
              right,
              t.objectExpression(
                defaultFacadeBatch.map(({ name, local }) =>
                  t.objectProperty(
                    t.isValidIdentifier(name)
                      ? t.identifier(name)
                      : t.stringLiteral(name),
                    t.cloneNode(local),
                    false,
                    t.isValidIdentifier(name) && local.name === name,
                  ),
                ),
              ),
            ],
          ),
        )
      : t.variableDeclaration("const", [
          t.variableDeclarator(
            (defaultId =
              programPath.scope.generateUidIdentifier("cjs_default")),
            right,
          ),
        ]);
    t.inherits(declaration, analysis.defaultWrite.path.node);
    analysis.defaultWrite.statement.replaceWith(declaration);
  }

  for (const marker of analysis.esModuleMarkers) {
    if (!marker.removed) marker.remove();
  }

  for (const getter of analysis.exportGetters) {
    if (getter.statement.removed) continue;
    for (const initializer of getter.initializers ?? []) {
      if (!initializer.statement.removed) initializer.statement.remove();
    }
    const expression = getter.expression.node;
    const local =
      expression.type === "Identifier"
        ? t.cloneNode(expression)
        : programPath.scope.generateUidIdentifier(getter.name);
    const replacements = [];
    if (expression.type !== "Identifier") {
      replacements.push(
        t.variableDeclaration("const", [
          t.variableDeclarator(t.cloneNode(local), expression),
        ]),
      );
    }
    replacements.push(
      t.exportNamedDeclaration(null, [
        t.exportSpecifier(t.cloneNode(local), t.identifier(getter.name)),
      ]),
    );
    getter.statement.replaceWithMultiple(replacements);
    exportedLocals.set(getter.name, local);
  }

  for (const [name, record] of analysis.namedWrites) {
    const finalWrite = record.final;
    const initStatements = new Set(
      record.initializers.map((entry) => entry.statement),
    );
    for (const statement of initStatements) {
      if (!statement.removed && statement !== finalWrite?.statement) {
        statement.remove();
      }
    }
    const right =
      finalWrite?.path.node.right ??
      t.unaryExpression("void", t.numericLiteral(0));
    const existing =
      t.isIdentifier(right) && programPath.scope.hasBinding(right.name)
        ? t.cloneNode(right)
        : null;
    const local = existing ?? programPath.scope.generateUidIdentifier(name);
    const replacements = [];
    if (!existing) {
      replacements.push(
        t.variableDeclaration("const", [
          t.variableDeclarator(t.cloneNode(local), right),
        ]),
      );
    }
    if (
      defaultId &&
      record.target === "module" &&
      !defaultFacadeBatch?.some((entry) => entry.name === name)
    ) {
      replacements.push(
        t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.cloneNode(defaultId),
              t.stringLiteral(name),
              true,
            ),
            t.cloneNode(local),
          ),
        ),
      );
    }
    const binding = existing
      ? programPath.scope.getBinding(existing.name)
      : undefined;
    const canExportDeclaration =
      existing?.name === name &&
      binding &&
      (binding.path.isFunctionDeclaration() ||
        binding.path.isClassDeclaration());
    if (canExportDeclaration && !directlyExportedBindings.has(name)) {
      directlyExportedBindings.add(name);
      binding.path.replaceWith(t.exportNamedDeclaration(binding.path.node));
    } else if (name !== "default" && t.isValidIdentifier(name)) {
      replacements.push(
        t.exportNamedDeclaration(null, [
          t.exportSpecifier(t.cloneNode(local), t.identifier(name)),
        ]),
      );
    }
    if (finalWrite?.statement && !finalWrite.statement.removed) {
      finalWrite.statement.replaceWithMultiple(replacements);
    } else if (replacements.length > 0) {
      programPath.pushContainer("body", replacements);
    }
    exportedLocals.set(name, local);
  }

  for (const read of analysis.exportReads) {
    if (read.path.removed) continue;
    const local = exportedLocals.get(read.name);
    if (local) read.path.replaceWith(t.cloneNode(local));
  }

  if (
    defaultId &&
    t.isObjectExpression(analysis.defaultWrite.path.node.right)
  ) {
    for (const property of analysis.defaultWrite.path.node.right.properties) {
      if (!t.isObjectProperty(property) || property.computed) continue;
      const name = readObjectPropertyName(property);
      if (
        !name ||
        name === "default" ||
        exportedLocals.has(name) ||
        !t.isValidIdentifier(name)
      ) {
        continue;
      }
      const local = programPath.scope.generateUidIdentifier(name);
      programPath.pushContainer("body", [
        t.variableDeclaration("const", [
          t.variableDeclarator(
            t.cloneNode(local),
            t.memberExpression(
              t.cloneNode(defaultId),
              t.stringLiteral(name),
              true,
            ),
          ),
        ]),
        t.exportNamedDeclaration(null, [
          t.exportSpecifier(t.cloneNode(local), t.identifier(name)),
        ]),
      ]);
      exportedLocals.set(name, local);
    }
  }

  if (!defaultId && !defaultFacadeBatch) {
    defaultId = programPath.scope.generateUidIdentifier("cjs_default");
    const properties = Array.from(exportedLocals, ([name, local]) =>
      t.objectProperty(t.stringLiteral(name), t.cloneNode(local), true),
    );
    programPath.pushContainer(
      "body",
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.cloneNode(defaultId),
          t.objectExpression(properties),
        ),
      ]),
    );
  }
  if (defaultId) {
    programPath.pushContainer(
      "body",
      t.exportDefaultDeclaration(t.cloneNode(defaultId)),
    );
  }

  programPath.scope.crawl();
  removeUnusedCjsHelpers(programPath);
  return {
    strategy: "static",
    body: [...imports.build(), ...programPath.node.body],
  };
}

function readDefaultFacadeBatch(analysis, programPath, t) {
  if (
    !analysis.defaultWrite ||
    !t.isIdentifier(analysis.defaultWrite.path.node.right)
  ) {
    return null;
  }
  const entries = [];
  const statements = new Set([analysis.defaultWrite.statement.node]);
  for (const [name, record] of analysis.namedWrites) {
    if (
      record.target !== "module" ||
      record.initializers.length > 0 ||
      !record.final ||
      !t.isIdentifier(record.final.path.node.right)
    ) {
      return null;
    }
    const local = record.final.path.node.right;
    const binding = programPath.scope.getBinding(local.name);
    if (!binding?.path.isFunctionDeclaration()) {
      return null;
    }
    entries.push({ name, local });
    statements.add(record.final.statement.node);
  }
  if (entries.length === 0) {
    return null;
  }

  const body = programPath.node.body;
  const first = body.indexOf(analysis.defaultWrite.statement.node);
  const last = Math.max(
    ...Array.from(statements, (node) => body.indexOf(node)),
  );
  if (
    first === -1 ||
    last === -1 ||
    body.slice(first, last + 1).some((statement) => !statements.has(statement))
  ) {
    return null;
  }
  return entries;
}

function analyzeStaticCjs(programPath, context) {
  const { t } = context;
  const analysis = {
    ok: true,
    reason: null,
    requires: [],
    namedWrites: new Map(),
    defaultWrite: null,
    exportReads: [],
    exportGetters: [],
    exportStars: [],
    exportStarRequireNodes: new Set(),
    esModuleMarkers: [],
    processReads: [],
  };
  const recognizedCalls = new Set();
  const fail = (reason) => {
    if (analysis.ok) {
      analysis.ok = false;
      analysis.reason = reason;
    }
  };

  programPath.traverse({
    CallExpression(callPath) {
      if (
        callPath.get("callee").isIdentifier({ name: "require" }) &&
        !callPath.scope.hasBinding("require")
      ) {
        if (
          callPath.node.arguments.length !== 1 ||
          !t.isStringLiteral(callPath.node.arguments[0])
        ) {
          fail("dynamic-require");
          return;
        }
        const statement = callPath.getStatementParent();
        if (!statement?.parentPath?.isProgram()) {
          fail("nested-require");
          return;
        }
        analysis.requires.push({
          path: callPath,
          statement,
          request: callPath.node.arguments[0].value,
        });
      }

      if (isExportsDefinePropertyNode(callPath.node, t)) {
        recognizedCalls.add(callPath.node);
        const statement = callPath.getStatementParent();
        if (!statement?.parentPath?.isProgram()) {
          fail("dynamic-export");
          return;
        }
        const name = callPath.node.arguments[1].value;
        if (name === "__esModule") {
          analysis.esModuleMarkers.push(statement);
          return;
        }
        const expression = readStaticExportGetter(callPath, t);
        if (!expression || name === "default" || !t.isValidIdentifier(name)) {
          fail("dynamic-export");
          return;
        }
        analysis.exportGetters.push({
          name,
          expression,
          path: callPath,
          statement,
        });
      }

      const exportStarRequest = readExportStarRequestNode(callPath.node, t);
      if (exportStarRequest) {
        recognizedCalls.add(callPath.node);
        const statement = callPath.getStatementParent();
        if (!statement?.parentPath?.isProgram()) {
          fail("dynamic-export");
          return;
        }
        const shape = { complete: false, names: new Set() };
        if (!shape.complete) {
          fail("dynamic-reexport");
          return;
        }
        const requireNode = callPath.node.arguments[0];
        analysis.exportStarRequireNodes.add(requireNode);
        analysis.exportStars.push({
          path: callPath,
          statement,
          request: exportStarRequest,
          names: Array.from(shape.names).sort(),
          exports: [],
        });
      }
    },
    AssignmentExpression(assignmentPath) {
      const target = readExportTargetNode(assignmentPath.node.left, t);
      if (!target) return;
      if (assignmentPath.node.operator !== "=") {
        fail("dynamic-export");
        return;
      }
      const statement = assignmentPath.getStatementParent();
      if (!statement?.parentPath?.isProgram()) {
        fail("nested-export");
        return;
      }
      if (target.kind === "default") {
        if (analysis.defaultWrite) fail("reassigned-default");
        analysis.defaultWrite = { path: assignmentPath, statement };
        return;
      }
      if (!t.isValidIdentifier(target.name) && target.name !== "default") {
        fail("dynamic-export");
        return;
      }
      const record = analysis.namedWrites.get(target.name) ?? {
        target: target.target,
        initializers: [],
        final: null,
      };
      if (record.target !== target.target) {
        fail("mixed-export-target");
        return;
      }
      const entry = { path: assignmentPath, statement };
      if (isVoidExportInitialization(assignmentPath.node.right, t)) {
        record.initializers.push(entry);
      } else if (record.final) {
        fail("reassigned-export");
      } else {
        record.final = entry;
      }
      analysis.namedWrites.set(target.name, record);
    },
    UpdateExpression(updatePath) {
      if (readExportTargetNode(updatePath.node.argument, t)) {
        fail("dynamic-export");
      }
    },
    UnaryExpression(unaryPath) {
      if (
        unaryPath.node.operator === "delete" &&
        readExportTargetNode(unaryPath.node.argument, t)
      ) {
        fail("dynamic-export");
      }
    },
    MemberExpression(memberPath) {
      if (isNodeEnvExpression(memberPath.node, t)) {
        analysis.processReads.push(memberPath);
        return;
      }
      const target = readExportTargetNode(memberPath.node, t);
      if (!target) return;
      const parent = memberPath.parentPath;
      if (
        parent?.isAssignmentExpression() &&
        parent.node.left === memberPath.node
      ) {
        return;
      }
      if (target.kind === "default") {
        if (
          parent?.isMemberExpression() &&
          parent.node.object === memberPath.node
        ) {
          return;
        }
        fail("exports-escape");
        return;
      }
      if (memberPath.findParent((item) => recognizedCalls.has(item.node))) {
        return;
      }
      analysis.exportReads.push({ name: target.name, path: memberPath });
    },
    Identifier(identifierPath) {
      const name = identifierPath.node.name;
      if (!identifierPath.isReferencedIdentifier()) return;
      if (name === "__dirname" || name === "__filename") {
        if (!identifierPath.scope.hasBinding(name)) fail("cjs-global");
        return;
      }
      if (name === "process" && !identifierPath.scope.hasBinding("process")) {
        if (
          !identifierPath.findParent((item) =>
            isNodeEnvExpression(item.node, t),
          )
        ) {
          fail("process-access");
        }
        return;
      }
      if (name === "exports" && !identifierPath.scope.hasBinding("exports")) {
        const parent = identifierPath.parentPath;
        const validMember =
          parent?.isMemberExpression() &&
          parent.node.object === identifierPath.node;
        const validCall = identifierPath.findParent((item) =>
          recognizedCalls.has(item.node),
        );
        if (!validMember && !validCall) fail("exports-escape");
      }
      if (name === "module" && !identifierPath.scope.hasBinding("module")) {
        const parent = identifierPath.parentPath;
        if (
          !parent?.isMemberExpression() ||
          parent.node.object !== identifierPath.node ||
          readMemberName(parent.node, t) !== "exports"
        ) {
          fail("module-escape");
        }
      }
    },
    ThisExpression(thisPath) {
      if (thisPath.getFunctionParent()) return;
      const declarator = thisPath.findParent((item) =>
        item.isVariableDeclarator(),
      );
      if (
        !declarator?.get("id").isIdentifier() ||
        !declarator.node.id.name.startsWith("__")
      ) {
        fail("top-level-this");
      }
    },
    ReturnStatement(returnPath) {
      if (!returnPath.getFunctionParent()) fail("top-level-return");
    },
  });

  if (analysis.defaultWrite) {
    for (const record of analysis.namedWrites.values()) {
      if (record.target === "exports") fail("mixed-export-target");
    }
  }
  const namedNames = new Set(analysis.namedWrites.keys());
  for (const getter of analysis.exportGetters) {
    const record = analysis.namedWrites.get(getter.name);
    if (record?.final) {
      fail("reassigned-export");
    } else if (record) {
      getter.initializers = record.initializers;
      analysis.namedWrites.delete(getter.name);
    }
    namedNames.add(getter.name);
  }
  for (const requireEntry of analysis.requires) {
    if (
      analysis.exportStarRequireNodes.has(requireEntry.path.node) ||
      isRequireInsideExportAssignment(requireEntry.path, t)
    ) {
      continue;
    }
    if (!isRequireInStaticPrologue(requireEntry.statement, programPath, t)) {
      fail("require-order");
    }
  }
  return analysis;
}

function createStaticImportManager(programPath, context) {
  const { t } = context;
  const records = new Map();
  const resolve = (request) => {
    const dependency = resolveCjsDependency({
      filePath: context.filePath,
      request,
    });
    return {
      dependency,
      specifier: dependency.kind === "builtin" ? dependency.request : request,
    };
  };
  const getRecord = (request) => {
    const resolved = resolve(request);
    const key = resolved.dependency.request;
    let record = records.get(key);
    if (!record) {
      record = {
        ...resolved,
        default: null,
        namespace: null,
        named: new Map(),
        sideEffect: false,
      };
      records.set(key, record);
    }
    return record;
  };
  return {
    ensureSideEffect(request) {
      getRecord(request).sideEffect = true;
    },
    ensureDefault(request, origin, preferred) {
      const record = getRecord(request);
      if (record.dependency.kind === "builtin") {
        record.namespace ??=
          preferred ?? programPath.scope.generateUidIdentifier("cjs_import");
        return record.namespace;
      }
      record.default ??=
        preferred ?? programPath.scope.generateUidIdentifier("cjs_import");
      return record.default;
    },
    ensureNamed(request) {
      getRecord(request);
      return null;
    },
    build() {
      const declarations = [];
      for (const record of records.values()) {
        if (record.namespace) {
          declarations.push(
            t.importDeclaration(
              [t.importNamespaceSpecifier(t.cloneNode(record.namespace))],
              t.stringLiteral(record.specifier),
            ),
          );
        }
        const specifiers = [];
        if (record.default) {
          specifiers.push(
            t.importDefaultSpecifier(t.cloneNode(record.default)),
          );
        }
        for (const [name, local] of record.named) {
          specifiers.push(
            t.importSpecifier(t.cloneNode(local), t.identifier(name)),
          );
        }
        if (specifiers.length > 0) {
          declarations.push(
            t.importDeclaration(specifiers, t.stringLiteral(record.specifier)),
          );
        } else if (record.sideEffect && !record.namespace) {
          declarations.push(
            t.importDeclaration([], t.stringLiteral(record.specifier)),
          );
        }
      }
      return declarations;
    },
  };
}

function convertObjectPatternRequire(
  declaratorPath,
  request,
  imports,
  context,
) {
  const { t } = context;
  const replacements = [];
  for (const propertyPath of declaratorPath.get("id.properties")) {
    if (
      !propertyPath.isObjectProperty() ||
      propertyPath.node.computed ||
      !propertyPath.get("value").isIdentifier()
    ) {
      return false;
    }
    const name = readObjectPropertyName(propertyPath.node);
    if (!name || name === "default") return false;
    const imported = imports.ensureNamed(request, name, propertyPath.node);
    if (!imported) return false;
    replacements.push({
      binding: declaratorPath.scope.getBinding(propertyPath.node.value.name),
      imported,
    });
  }
  for (const { binding, imported } of replacements) {
    for (const reference of binding?.referencePaths ?? []) {
      reference.replaceWith(t.cloneNode(imported));
    }
  }
  removeDeclarator(declaratorPath);
  return true;
}

function convertIdentifierRequire(declaratorPath, request, imports, context) {
  const { t } = context;
  const name = declaratorPath.node.id.name;
  const binding = declaratorPath.scope.getBinding(name);
  const memberReferences = [];
  let canUseNamed = Boolean(binding);
  for (const reference of binding?.referencePaths ?? []) {
    const parent = reference.parentPath;
    const property =
      parent?.isMemberExpression() && parent.node.object === reference.node
        ? readMemberName(parent.node, t)
        : null;
    if (!property || property === "default") {
      canUseNamed = false;
      break;
    }
    const imported = imports.ensureNamed(request, property, parent.node);
    if (!imported) {
      canUseNamed = false;
      break;
    }
    memberReferences.push({ parent, imported });
  }
  if (canUseNamed && memberReferences.length > 0) {
    for (const entry of memberReferences) {
      entry.parent.replaceWith(t.cloneNode(entry.imported));
    }
    removeDeclarator(declaratorPath);
    return true;
  }
  const preferred = t.identifier(name);
  const imported = imports.ensureDefault(
    request,
    declaratorPath.node,
    preferred,
  );
  if (imported.name !== name) {
    for (const reference of binding?.referencePaths ?? []) {
      reference.replaceWith(t.cloneNode(imported));
    }
  }
  removeDeclarator(declaratorPath);
  return true;
}

function removeDeclarator(declaratorPath) {
  const declaration = declaratorPath.parentPath;
  declaratorPath.remove();
  if (declaration.node?.declarations.length === 0) declaration.remove();
}

function readStaticExportGetter(callPath, t) {
  const descriptor = callPath.node.arguments[2];
  if (!t.isObjectExpression(descriptor)) return null;
  const getter = descriptor.properties.find(
    (property) =>
      t.isObjectProperty(property) &&
      !property.computed &&
      readObjectPropertyName(property) === "get",
  );
  if (
    !getter ||
    (!t.isFunctionExpression(getter.value) &&
      !t.isArrowFunctionExpression(getter.value))
  ) {
    return null;
  }
  const statements = t.isBlockStatement(getter.value.body)
    ? getter.value.body.body
    : [];
  if (
    statements.length !== 1 ||
    !t.isReturnStatement(statements[0]) ||
    !statements[0].argument
  ) {
    return null;
  }
  const argumentPath = callPath
    .get("arguments.2.properties")
    .find((propertyPath) => readObjectPropertyName(propertyPath.node) === "get")
    ?.get("value.body.body.0.argument");
  return argumentPath?.node ? argumentPath : null;
}

function isVoidExportInitialization(node, t) {
  if (t.isUnaryExpression(node, { operator: "void" })) return true;
  return t.isAssignmentExpression(node, { operator: "=" })
    ? isVoidExportInitialization(node.right, t)
    : false;
}

function isRequireInsideExportAssignment(callPath, t) {
  const assignment = callPath.findParent((item) =>
    item.isAssignmentExpression(),
  );
  return Boolean(assignment && readExportTargetNode(assignment.node.left, t));
}

function isRequireInStaticPrologue(statementPath, programPath, t) {
  const statements = programPath.get("body");
  const index = statements.findIndex(
    (item) => item.node === statementPath.node,
  );
  if (index < 0) return false;
  for (let current = 0; current < index; current += 1) {
    const statement = statements[current];
    if (statement.isFunctionDeclaration()) continue;
    if (statement.isVariableDeclaration()) {
      const helperOnly = statement.node.declarations.every(
        (declaration) =>
          t.isIdentifier(declaration.id) &&
          declaration.id.name.startsWith("__"),
      );
      const containsRequire = containsStaticRequire(statement.node, t);
      if (helperOnly || containsRequire) continue;
    }
    if (
      statement.isExpressionStatement() &&
      (isExportsDefinePropertyNode(statement.node.expression, t) ||
        Boolean(readRequireRequest(statement.node.expression, t)) ||
        Boolean(readExportStarRequestNode(statement.node.expression, t)) ||
        (t.isAssignmentExpression(statement.node.expression) &&
          isVoidExportInitialization(statement.node.expression.right, t)))
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function containsStaticRequire(node, t) {
  let found = false;
  walkAst(node, (item) => {
    if (readRequireRequest(item, t)) found = true;
  });
  return found;
}

function removeUnusedCjsHelpers(programPath) {
  programPath.scope.crawl();
  for (const name of [
    "__createBinding",
    "__exportStar",
    "__importDefault",
    "__importStar",
  ]) {
    const binding = programPath.scope.getBinding(name);
    if (!binding || binding.referenced) continue;
    if (binding.path.isVariableDeclarator()) removeDeclarator(binding.path);
    else binding.path.remove();
  }
}

function createCompatibilityWrapper(programPath, context) {
  const { t, filePath, moduleIdentity, envId, nodeEnv } = context;
  const originalBody = programPath.node.body;
  const originalDirectives = programPath.node.directives;
  const requires = collectCjsRequires(programPath, t);
  const namedExports = Array.from(
    new Set(collectCjsNamedExports(programPath, t)),
  ).sort();
  const imports = [];
  const switchCases = [];

  for (const [index, request] of requires.entries()) {
    const local = t.identifier(`__cjs_dep_${index}`);
    const dependency = resolveCjsDependency({
      filePath,
      request,
    });
    if (dependency.kind === "builtin") {
      imports.push(
        t.importDeclaration(
          [t.importNamespaceSpecifier(local)],
          t.stringLiteral(dependency.request),
        ),
      );
    } else {
      imports.push(
        t.importDeclaration(
          [t.importDefaultSpecifier(local)],
          t.stringLiteral(request),
        ),
      );
    }
    switchCases.push(
      t.switchCase(t.stringLiteral(request), [
        t.returnStatement(t.cloneNode(local)),
      ]),
    );
  }

  const requestId = t.identifier("request");
  switchCases.push(
    t.switchCase(null, [
      t.throwStatement(
        t.newExpression(t.identifier("Error"), [
          t.binaryExpression(
            "+",
            t.binaryExpression(
              "+",
              t.stringLiteral("Cannot require "),
              t.cloneNode(requestId),
            ),
            t.stringLiteral(` from ${moduleIdentity}`),
          ),
        ]),
      ),
    ]),
  );

  const processId = t.identifier("__cjs_process__");
  const requireId = t.identifier("__cjs_require__");
  const cacheId = t.identifier("__cjs_cache__");
  const defaultId = t.identifier("__cjs_default__");
  const moduleId = t.identifier("__cjs_module__");
  const exportsId = t.identifier("__cjs_exports__");
  const cacheKeyLiteral = t.stringLiteral(
    `${moduleIdentity}::env=${envId}::NODE_ENV=${nodeEnv}`,
  );
  const usesFilename =
    context.linkModulePaths && usesUnboundGlobal(programPath, "__filename");
  const usesDirname =
    context.linkModulePaths && usesUnboundGlobal(programPath, "__dirname");
  const fileReference = usesFilename
    ? createModulePathReference(context, "module-filename")
    : null;
  const directoryReference = usesDirname
    ? createModulePathReference(context, "module-dirname")
    : null;
  const moduleExports = () =>
    t.memberExpression(t.cloneNode(moduleId), t.identifier("exports"));
  const cacheCall = (method, args) =>
    t.callExpression(
      t.memberExpression(t.cloneNode(cacheId), t.identifier(method)),
      args,
    );

  const wrapperBody = t.blockStatement(originalBody, originalDirectives);
  const invokeCjs = t.callExpression(
    t.arrowFunctionExpression(
      [
        t.identifier("module"),
        t.identifier("exports"),
        t.identifier("require"),
        t.identifier("process"),
        t.identifier("__filename"),
        t.identifier("__dirname"),
      ],
      wrapperBody,
    ),
    [
      t.cloneNode(moduleId),
      t.cloneNode(exportsId),
      t.cloneNode(requireId),
      t.cloneNode(processId),
      fileReference
        ? t.identifier(fileReference.symbol)
        : context.linkModulePaths
          ? t.unaryExpression("void", t.numericLiteral(0))
          : t.stringLiteral(moduleIdentity),
      directoryReference
        ? t.identifier(directoryReference.symbol)
        : context.linkModulePaths
          ? t.unaryExpression("void", t.numericLiteral(0))
          : t.stringLiteral(path.posix.dirname(moduleIdentity)),
    ],
  );

  const body = [
    ...imports,
    t.variableDeclaration("const", [
      t.variableDeclarator(
        processId,
        t.objectExpression([
          t.objectProperty(
            t.identifier("env"),
            t.objectExpression([
              t.objectProperty(
                t.identifier("NODE_ENV"),
                t.stringLiteral(nodeEnv),
              ),
            ]),
          ),
        ]),
      ),
    ]),
    t.functionDeclaration(
      requireId,
      [requestId],
      t.blockStatement([
        t.switchStatement(t.cloneNode(requestId), switchCases),
      ]),
    ),
    t.variableDeclaration("const", [
      t.variableDeclarator(
        cacheId,
        t.assignmentExpression(
          "??=",
          t.memberExpression(
            t.identifier("globalThis"),
            t.identifier("__BUNDLER_CJS_CACHE__"),
          ),
          t.newExpression(t.identifier("Map"), []),
        ),
      ),
    ]),
    t.variableDeclaration("let", [
      t.variableDeclarator(
        defaultId,
        cacheCall("get", [t.cloneNode(cacheKeyLiteral)]),
      ),
    ]),
    t.ifStatement(
      t.unaryExpression("!", t.cloneNode(defaultId)),
      t.blockStatement([
        t.variableDeclaration("const", [
          t.variableDeclarator(
            moduleId,
            t.objectExpression([
              t.objectProperty(t.identifier("exports"), t.objectExpression([])),
            ]),
          ),
        ]),
        t.variableDeclaration("const", [
          t.variableDeclarator(exportsId, moduleExports()),
        ]),
        t.expressionStatement(
          cacheCall("set", [
            t.cloneNode(cacheKeyLiteral),
            t.cloneNode(exportsId),
          ]),
        ),
        t.expressionStatement(invokeCjs),
        t.expressionStatement(
          t.assignmentExpression("=", t.cloneNode(defaultId), moduleExports()),
        ),
        t.expressionStatement(
          cacheCall("set", [
            t.cloneNode(cacheKeyLiteral),
            t.cloneNode(defaultId),
          ]),
        ),
      ]),
    ),
    t.exportDefaultDeclaration(t.cloneNode(defaultId)),
  ];

  for (const name of namedExports) {
    body.push(
      t.exportNamedDeclaration(
        t.variableDeclaration("const", [
          t.variableDeclarator(
            t.identifier(name),
            t.memberExpression(
              t.cloneNode(defaultId),
              t.stringLiteral(name),
              true,
            ),
          ),
        ]),
      ),
    );
  }
  return body;
}

function usesUnboundGlobal(programPath, name) {
  let used = false;
  programPath.traverse({
    ReferencedIdentifier(identifierPath) {
      if (
        identifierPath.node.name === name &&
        !identifierPath.scope.hasBinding(name)
      ) {
        used = true;
        identifierPath.stop();
      }
    },
  });
  return used;
}

function createModulePathReference(context, kind) {
  const ownerId = context.moduleIdentity;
  const digest = crypto
    .createHash("sha1")
    .update(`${ownerId}\0${kind}`)
    .digest("hex");
  const short = BigInt(`0x${digest}`).toString(36).slice(0, 10);
  const suffix = kind.slice("module-".length).replaceAll("-", "_");
  const reference = {
    id: `${ownerId}::${kind}`,
    kind,
    symbol: `__bundler_${short}_${suffix}`,
    ownerId,
  };
  if (!context.linkReferences.some((item) => item.id === reference.id)) {
    context.linkReferences.push(reference);
  }
  return reference;
}

function createConditionalWrapper(programPath, context) {
  const selected = selectNodeEnvConditional(programPath.node.body, context);
  if (!selected) {
    return null;
  }

  if (selected.direct) {
    const specifier = encodeCjsDependencySpecifier(context, selected.direct);
    return [
      context.t.exportNamedDeclaration(
        null,
        [
          context.t.exportSpecifier(
            context.t.identifier("default"),
            context.t.identifier("default"),
          ),
        ],
        context.t.stringLiteral(specifier),
      ),
      context.t.exportAllDeclaration(context.t.stringLiteral(specifier)),
    ];
  }

  const assigned = selected.assigned;
  const exportAssignments = collectVariableExportAssignments(
    programPath.node.body,
    context.t,
  );
  if (!assigned || exportAssignments.length === 0) {
    return null;
  }

  const { t } = context;
  const imports = [];
  const imported = new Map();
  for (const variable of new Set(
    exportAssignments.map((item) => item.variable),
  )) {
    const request = assigned.get(variable);
    if (!request) {
      return null;
    }
    const local = t.identifier(`__cjs_selected_${variable}`);
    imported.set(variable, local);
    imports.push(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.cloneNode(local))],
        t.stringLiteral(encodeCjsDependencySpecifier(context, request)),
      ),
    );
  }

  const exports = exportAssignments.map(({ exported, variable, property }) =>
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier(exported),
          t.memberExpression(
            t.cloneNode(imported.get(variable)),
            t.stringLiteral(property),
            true,
          ),
        ),
      ]),
    ),
  );
  const defaultId = t.identifier("__cjs_default__");
  const defaultBody = [
    t.variableDeclaration("const", [
      t.variableDeclarator(defaultId, t.objectExpression([])),
    ]),
    ...exportAssignments.map(({ exported }) =>
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(
            t.identifier("Object"),
            t.identifier("defineProperty"),
          ),
          [
            t.cloneNode(defaultId),
            t.stringLiteral(exported),
            t.objectExpression([
              t.objectProperty(
                t.identifier("enumerable"),
                t.booleanLiteral(true),
              ),
              t.objectMethod(
                "method",
                t.identifier("get"),
                [],
                t.blockStatement([t.returnStatement(t.identifier(exported))]),
              ),
            ]),
          ],
        ),
      ),
    ),
    t.exportDefaultDeclaration(t.cloneNode(defaultId)),
  ];
  return [...imports, ...exports, ...defaultBody];
}

function resolveCjsDependency({ request }) {
  if (isNodeBuiltin(request)) {
    return {
      kind: "builtin",
      request: request.startsWith("node:") ? request : `node:${request}`,
    };
  }

  return { kind: "cjs", request };
}

function encodeCjsDependencySpecifier(context, request) {
  const dependency = resolveCjsDependency({
    filePath: context.filePath,
    request,
  });
  return dependency.kind === "builtin" ? dependency.request : request;
}

function collectCjsRequires(programPath, t) {
  const requires = new Set();
  programPath.traverse({
    CallExpression(callPath) {
      if (
        t.isIdentifier(callPath.node.callee, { name: "require" }) &&
        callPath.node.arguments.length === 1 &&
        t.isStringLiteral(callPath.node.arguments[0])
      ) {
        requires.add(callPath.node.arguments[0].value);
      }
    },
  });
  return Array.from(requires);
}

function collectCjsNamedExports(programPath, t) {
  const exports = new Set();
  programPath.traverse({
    AssignmentExpression(assignmentPath) {
      const name = readExportsMemberName(assignmentPath.node.left, t);
      if (name && name !== "default" && t.isValidIdentifier(name)) {
        exports.add(name);
      }
    },
  });
  return Array.from(exports).sort();
}

function readExportsMemberName(node, t) {
  if (!t.isMemberExpression(node)) {
    return null;
  }
  const directExports = t.isIdentifier(node.object, { name: "exports" });
  const moduleExports =
    t.isMemberExpression(node.object) &&
    t.isIdentifier(node.object.object, { name: "module" }) &&
    readMemberName(node.object, t) === "exports";
  return directExports || moduleExports ? readMemberName(node, t) : null;
}

function readMemberName(node, t) {
  if (!node.computed && t.isIdentifier(node.property)) {
    return node.property.name;
  }
  return t.isStringLiteral(node.property) ? node.property.value : null;
}

function selectNodeEnvConditional(body, context) {
  const { t, nodeEnv } = context;
  for (const statement of body) {
    if (!t.isIfStatement(statement) || !statement.alternate) {
      continue;
    }
    const comparison = readNodeEnvComparison(statement.test, t);
    if (!comparison) {
      continue;
    }
    const consequentDirect = readBranchModuleExportRequire(
      statement.consequent,
      t,
    );
    const alternateDirect = readBranchModuleExportRequire(
      statement.alternate,
      t,
    );
    const useConsequent = evaluateNodeEnvComparison(comparison, nodeEnv);
    if (consequentDirect && alternateDirect) {
      return {
        direct: useConsequent ? consequentDirect : alternateDirect,
        assigned: null,
      };
    }

    const consequentAssigned = readBranchRequireAssignments(
      statement.consequent,
      t,
    );
    const alternateAssigned = readBranchRequireAssignments(
      statement.alternate,
      t,
    );
    if (
      consequentAssigned &&
      alternateAssigned &&
      sameMapKeys(consequentAssigned, alternateAssigned)
    ) {
      return {
        direct: null,
        assigned: useConsequent ? consequentAssigned : alternateAssigned,
      };
    }
  }
  return null;
}

function readNodeEnvComparison(node, t) {
  if (
    !t.isBinaryExpression(node) ||
    !["===", "==", "!==", "!="].includes(node.operator)
  ) {
    return null;
  }
  const leftIsEnv = isNodeEnvExpression(node.left, t);
  const rightIsEnv = isNodeEnvExpression(node.right, t);
  const literal = leftIsEnv ? node.right : rightIsEnv ? node.left : null;
  return literal && t.isStringLiteral(literal)
    ? { operator: node.operator, expected: literal.value }
    : null;
}

function evaluateNodeEnvComparison(comparison, nodeEnv) {
  const equal = nodeEnv === comparison.expected;
  return comparison.operator === "===" || comparison.operator === "=="
    ? equal
    : !equal;
}

function readBranchModuleExportRequire(branch, t) {
  const requests = branchStatements(branch, t)
    .map((statement) => {
      if (!t.isExpressionStatement(statement)) return null;
      const expression = statement.expression;
      return t.isAssignmentExpression(expression, { operator: "=" }) &&
        isModuleExportsNode(expression.left, t)
        ? readRequireRequest(expression.right, t)
        : null;
    })
    .filter(Boolean);
  return requests.length === 1 ? requests[0] : null;
}

function readBranchRequireAssignments(branch, t) {
  const assigned = new Map();
  for (const statement of branchStatements(branch, t)) {
    if (!t.isExpressionStatement(statement)) continue;
    const expression = statement.expression;
    if (
      !t.isAssignmentExpression(expression, { operator: "=" }) ||
      !t.isIdentifier(expression.left)
    ) {
      continue;
    }
    const request = readRequireRequest(expression.right, t);
    if (!request || assigned.has(expression.left.name)) {
      continue;
    }
    assigned.set(expression.left.name, request);
  }
  return assigned.size > 0 ? assigned : null;
}

function branchStatements(branch, t) {
  return t.isBlockStatement(branch) ? branch.body : [branch];
}

function sameMapKeys(left, right) {
  return (
    left.size === right.size &&
    Array.from(left.keys()).every((key) => right.has(key))
  );
}

function collectVariableExportAssignments(body, t) {
  const exports = [];
  for (const statement of body) {
    if (!t.isExpressionStatement(statement)) continue;
    const expression = statement.expression;
    if (!t.isAssignmentExpression(expression, { operator: "=" })) continue;
    const target = readExportTargetNode(expression.left, t);
    if (!target || target.kind !== "named" || target.name === "default") {
      continue;
    }
    if (!t.isMemberExpression(expression.right)) continue;
    const variable = expression.right.object;
    const property = readMemberName(expression.right, t);
    if (!t.isIdentifier(variable) || !property) continue;
    exports.push({
      exported: target.name,
      variable: variable.name,
      property,
    });
  }
  return exports;
}
