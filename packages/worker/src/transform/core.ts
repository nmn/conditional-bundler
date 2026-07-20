import { parse, type ParserPlugin } from "@babel/parser";
import traverseModule, { type NodePath, type Binding } from "@babel/traverse";
import generateModule from "@babel/generator";
import * as t from "@babel/types";
import type {
  TransformInput,
  TransformResult,
  ImportEntry,
  ImportSpecifier,
  ExportLocal,
  ExportStar,
  ReexportNamed,
  ConditionalImport,
  CellRecord,
  FileRecord,
  CellExternalDep,
  DependencyTarget,
} from "@bundler/shared";
import { filePrefix, contentHash } from "@bundler/shared";
import { modulePrefixIdentity } from "../module-identity.js";

export type CoreTransformOptions = {
  importAttrAllow: string[];
  environmentVariables?: Readonly<Record<string, string>>;
  generateModuleOutput?: boolean;
  sourceMap?: {
    sourceFileName: string;
    sourcesContent: boolean;
    embedCellSourcesContent?: boolean;
  };
};

type ResolvedImportInfo = {
  source: string;
  request: string;
  prefixModuleId?: string | null;
  target: DependencyTarget;
  pkg: TransformInput["pkg"];
  relPath: string;
};

function resolvedImportPrefix(resolved: ResolvedImportInfo): string {
  return filePrefix(
    resolved.pkg.name,
    resolved.pkg.version,
    modulePrefixIdentity(resolved.prefixModuleId, resolved.relPath),
  );
}

function getParserPlugins(
  input: Pick<TransformInput, "syntax">,
): ParserPlugin[] {
  const plugins: ParserPlugin[] = ["importAttributes"];
  if (input.syntax.ts) {
    plugins.push("typescript");
  }
  if (input.syntax.jsx) {
    plugins.push("jsx");
  }
  return plugins;
}

export type CoreImportRequest = {
  key: string;
  kind:
    | "import"
    | "dynamic-import"
    | "reexport"
    | "conditional-import"
    | "conditional-else";
  request: string;
  importAttributes?: Record<string, string>;
};

export type PreparedCoreTransform = {
  ast: t.File;
  importRequests: CoreImportRequest[];
};

export function prepareCoreTransform(
  input: Pick<TransformInput, "code" | "realPath" | "syntax"> & {
    environmentVariables?: Readonly<Record<string, string>>;
  },
  sourceFileName = input.realPath,
): PreparedCoreTransform {
  const ast = parse(input.code, {
    sourceType: "module",
    sourceFilename: sourceFileName,
    plugins: getParserPlugins(input),
  });
  foldBuildTimeImportConditions(
    ast,
    input.environmentVariables ?? {},
    input.realPath,
  );
  return {
    ast,
    importRequests: scanImportRequestsFromAst(ast),
  };
}

export function scanImportRequests(
  input: Pick<TransformInput, "code" | "realPath" | "syntax"> & {
    environmentVariables?: Readonly<Record<string, string>>;
  },
): CoreImportRequest[] {
  return prepareCoreTransform(input).importRequests;
}

function scanImportRequestsFromAst(ast: t.File): CoreImportRequest[] {
  const traverse = ((
    traverseModule as unknown as {
      default?: typeof import("@babel/traverse").default;
    }
  ).default ??
    (traverseModule as unknown as typeof import("@babel/traverse").default)) as typeof import("@babel/traverse").default;
  const requests = new Map<string, CoreImportRequest>();
  const add = (
    kind: CoreImportRequest["kind"],
    request: string,
    importAttributes?: Record<string, string>,
  ) => {
    const key = toImportResolutionKey(kind, request, importAttributes);
    requests.set(key, { key, kind, request, importAttributes });
  };

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const request = path.node.source.value;
      const attributes = readImportAttributes(path.node);
      add(
        attributes.condition ? "conditional-import" : "import",
        request,
        Object.keys(attributes).length > 0 ? attributes : undefined,
      );
      if (attributes.else) {
        const elseAttributes = Object.fromEntries(
          Object.entries(attributes).filter(
            ([key]) => key !== "condition" && key !== "else",
          ),
        );
        add(
          "conditional-else",
          attributes.else,
          Object.keys(elseAttributes).length > 0 ? elseAttributes : undefined,
        );
      }
    },
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.source) {
        add("reexport", path.node.source.value);
      }
    },
    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      add("reexport", path.node.source.value);
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      if (
        path.get("callee").isIdentifier({ name: "require" }) &&
        !path.scope.hasBinding("require") &&
        path.node.arguments.length === 1 &&
        t.isStringLiteral(path.node.arguments[0])
      ) {
        add("import", path.node.arguments[0].value);
      }
    },
  });

  return Array.from(requests.values());
}

export function transformWithCore(
  input: TransformInput,
  options: CoreTransformOptions,
  prepared?: PreparedCoreTransform,
): TransformResult {
  const ast =
    prepared?.ast ??
    prepareCoreTransform(
      {
        code: input.code,
        realPath: input.realPath,
        syntax: input.syntax,
        environmentVariables: options.environmentVariables,
      },
      options.sourceMap?.sourceFileName,
    ).ast;

  const traverse = ((
    traverseModule as unknown as {
      default?: typeof import("@babel/traverse").default;
    }
  ).default ??
    (traverseModule as unknown as typeof import("@babel/traverse").default)) as typeof import("@babel/traverse").default;
  const generate = ((
    generateModule as unknown as {
      default?: typeof import("@babel/generator").default;
    }
  ).default ??
    (generateModule as unknown as typeof import("@babel/generator").default)) as typeof import("@babel/generator").default;

  const moduleIdentity = transformModuleIdentity(input);
  const canonical = parseCanonicalPath(
    input.symbolIdentity ?? moduleIdentity ?? input.canonicalPath,
  );
  const prefix = filePrefix(
    canonical.pkg.name,
    canonical.pkg.version,
    canonical.relativePath,
  );

  let hasTopLevelAwait = false;

  traverse(ast, {
    AwaitExpression(path: NodePath<t.AwaitExpression>) {
      if (path.getFunctionParent() == null) {
        hasTopLevelAwait = true;
      }
    },
    ForOfStatement(path: NodePath<t.ForOfStatement>) {
      if (path.node.await && path.getFunctionParent() == null) {
        hasTopLevelAwait = true;
      }
    },
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      if (t.isIdentifier(path.node.left)) {
        const binding = path.scope.getBinding(path.node.left.name);
        if (binding?.kind === "module") {
          throw new Error(
            `E_IMPORT_ASSIGN: Cannot assign to import '${path.node.left.name}' from '${input.realPath}'`,
          );
        }
      }
    },
    UpdateExpression(path: NodePath<t.UpdateExpression>) {
      if (t.isIdentifier(path.node.argument)) {
        const binding = path.scope.getBinding(path.node.argument.name);
        if (binding?.kind === "module") {
          throw new Error(
            `E_IMPORT_ASSIGN: Cannot assign to import '${path.node.argument.name}' from '${input.realPath}'`,
          );
        }
      }
    },
  });

  const importMeta = collectImports(ast, input, options, traverse);

  const exportStars: ExportStar[] = [];
  const reexportsNamed: ReexportNamed[] = [];
  const exportsLocal: ExportLocal[] = [];
  const importedBindings = new Map<
    string,
    { entry: ImportEntry; specifier: ImportSpecifier }
  >();
  for (const entry of importMeta.imports) {
    if (
      entry.kind !== "value" ||
      entry.target.kind !== "file" ||
      entry.condition
    ) {
      continue;
    }
    for (const specifier of entry.specifiers) {
      importedBindings.set(specifier.local, { entry, specifier });
    }
  }
  const externalImportLocals = new Set<string>();
  for (const entry of importMeta.imports) {
    if (entry.target.kind !== "runtime" || entry.kind !== "value") {
      continue;
    }
    for (const spec of entry.specifiers) {
      externalImportLocals.add(spec.local);
    }
  }
  const renameMap = new Map<string, string>();
  const renameReverse = new Map<string, string>();
  const handledDefaultExports = new WeakSet<t.ExportDefaultDeclaration>();

  traverse(ast, {
    Program(path) {
      const bindings = path.scope.getAllBindings() as Record<string, Binding>;
      for (const [name, binding] of Object.entries(bindings)) {
        if (binding.scope !== path.scope) {
          continue;
        }
        const isImportBinding =
          binding.path.isImportSpecifier() ||
          binding.path.isImportDefaultSpecifier() ||
          binding.path.isImportNamespaceSpecifier();
        if (
          binding.kind === "module" &&
          isImportBinding &&
          !externalImportLocals.has(name)
        ) {
          continue;
        }
        const nextName = `${prefix}_${name}`;
        renameMap.set(name, nextName);
        renameReverse.set(nextName, name);
        renameModuleBinding(binding, name, nextName);
        delete path.scope.bindings[name];
        path.scope.bindings[nextName] = binding;
      }
    },
    NewExpression(path: NodePath<t.NewExpression>) {
      if (!t.isIdentifier(path.node.callee, { name: "URL" })) {
        return;
      }
      if (path.node.arguments.length !== 2) {
        return;
      }
      const [first, second] = path.node.arguments;
      if (!t.isStringLiteral(first)) {
        return;
      }
      if (!t.isMemberExpression(second)) {
        return;
      }
      if (!isImportMetaUrl(second)) {
        return;
      }
      path.replaceWith(
        t.callExpression(t.identifier("__BUNDLER_URL__"), [
          t.stringLiteral(prefix),
          t.stringLiteral(first.value),
        ]),
      );
    },
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!input.dev?.hmr || !isImportMetaHot(path.node)) {
        return;
      }
      path.replaceWith(
        t.callExpression(
          t.memberExpression(
            t.identifier("__BUNDLER_HMR__"),
            t.identifier("hot"),
          ),
          [t.stringLiteral(moduleIdentity)],
        ),
      );
    },
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.source) {
        const request = path.node.source.value;
        const resolved = resolveImportForHash(input, request, "reexport");
        const sourceOrder = path.node.start ?? 0;
        for (const spec of path.node.specifiers) {
          if (t.isExportNamespaceSpecifier(spec)) {
            const exported = spec.exported.name;
            reexportsNamed.push({
              source: resolved.relPath,
              request,
              target: resolved.target,
              imported: "*",
              exported,
              isNamespace: true,
              sourceOrder,
            });
          } else if (t.isExportSpecifier(spec)) {
            const imported = t.isIdentifier(spec.local) ? spec.local.name : "";
            const exported = t.isIdentifier(spec.exported)
              ? spec.exported.name
              : "";
            reexportsNamed.push({
              source: resolved.relPath,
              request,
              target: resolved.target,
              imported,
              exported,
              sourceOrder,
            });
          }
        }
        if (resolved.target.kind === "file") {
          path.remove();
        }
        return;
      }
      if (path.node.declaration) {
        const decl = path.node.declaration;
        if (t.isFunctionDeclaration(decl) && decl.id) {
          const local = renameReverse.get(decl.id.name) ?? decl.id.name;
          exportsLocal.push({ local, exported: local, kind: "func" });
          path.replaceWith(decl);
          return;
        }
        if (t.isClassDeclaration(decl) && decl.id) {
          const local = renameReverse.get(decl.id.name) ?? decl.id.name;
          exportsLocal.push({ local, exported: local, kind: "class" });
          path.replaceWith(decl);
          return;
        }
        if (t.isVariableDeclaration(decl)) {
          const extraExports: ExportLocal[] = [];
          for (const varDecl of decl.declarations) {
            if (t.isIdentifier(varDecl.id)) {
              const local =
                renameReverse.get(varDecl.id.name) ?? varDecl.id.name;
              extraExports.push({ local, exported: local, kind: "var" });
            }
          }
          if (extraExports.length > 0) {
            exportsLocal.push(...extraExports);
          }
          path.replaceWith(decl);
          return;
        }
        path.remove();
        return;
      }
      if (path.node.specifiers.length > 0) {
        const declarations: t.VariableDeclarator[] = [];
        for (const spec of path.node.specifiers) {
          if (t.isExportSpecifier(spec)) {
            const local = t.isIdentifier(spec.local) ? spec.local.name : "";
            const exported = t.isIdentifier(spec.exported)
              ? spec.exported.name
              : "";
            const localRenamed = renameMap.get(local) ?? local;
            const originalLocal =
              renameReverse.get(localRenamed) ?? localRenamed;
            const importedBinding = importedBindings.get(originalLocal);
            if (importedBinding) {
              reexportsNamed.push({
                source: importedBinding.entry.source,
                request: importedBinding.entry.request,
                target: importedBinding.entry.target,
                imported: importedBinding.specifier.imported,
                exported,
                isNamespace:
                  importedBinding.specifier.imported === "*" || undefined,
                sourceOrder: path.node.start ?? 0,
              });
              continue;
            }
            if (exported && originalLocal !== exported) {
              exportsLocal.push({ local: exported, exported, kind: "var" });
              declarations.push(
                t.variableDeclarator(
                  t.identifier(`${prefix}_${exported}`),
                  t.identifier(localRenamed),
                ),
              );
            } else {
              exportsLocal.push({
                local: originalLocal,
                exported,
                kind: "var",
              });
            }
          }
        }
        if (declarations.length > 0) {
          path.replaceWith(t.variableDeclaration("const", declarations));
        } else {
          path.remove();
        }
        return;
      }
    },
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      if (handledDefaultExports.has(path.node)) {
        return;
      }
      if (
        t.isIdentifier(path.node.declaration) &&
        path.node.declaration.name === `${prefix}_default`
      ) {
        return;
      }
      exportsLocal.push({
        local: "default",
        exported: "default",
        kind: "default",
      });
      const expr = exportDefaultToExpression(path.node.declaration);
      const local = t.identifier(`${prefix}_default`);
      const decl = t.variableDeclaration("const", [
        t.variableDeclarator(local, expr),
      ]);
      handledDefaultExports.add(path.node);
      path.replaceWith(decl);
    },
    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      const request = path.node.source.value;
      const resolved = resolveImportForHash(input, request, "reexport");
      const exported = (
        path.node as t.ExportAllDeclaration & { exported?: t.Identifier }
      ).exported;
      const sourceOrder = path.node.start ?? 0;
      if (exported && t.isIdentifier(exported)) {
        reexportsNamed.push({
          source: resolved.relPath,
          request,
          target: resolved.target,
          imported: "*",
          exported: exported.name,
          isNamespace: true,
          sourceOrder,
        });
        if (resolved.target.kind === "file") {
          path.remove();
        }
        return;
      }
      exportStars.push({
        source: resolved.relPath,
        request,
        target: resolved.target,
        sourceOrder,
      });
      if (resolved.target.kind === "file") {
        path.remove();
      }
    },
  });

  rewriteImportsInAst(ast, input, prefix, importMeta.imports, traverse);
  removeImportDeclarations(input, ast, traverse);

  if (hasTopLevelAwait) {
    throw new Error(
      `E_TLA: Top-level 'await' is not supported (v1). at ${input.realPath}`,
    );
  }

  const output =
    options.generateModuleOutput === false
      ? undefined
      : generate(
          ast,
          {
            sourceMaps: Boolean(options.sourceMap),
            sourceFileName: options.sourceMap?.sourceFileName ?? input.realPath,
            shouldPrintComment: shouldPrintSourceComment,
          },
          input.code,
        );
  let transformedCode = output?.code ?? "";
  const conditionalBindingCells = buildConditionalBindingCells(
    importMeta.imports,
    importMeta.conditionalImports,
    input,
    prefix,
  );
  if (output && conditionalBindingCells.length > 0) {
    transformedCode = `${conditionalBindingCells.map((cell) => cell.code).join("\n")}\n${transformedCode}`;
  }
  const imports = importMeta.imports.map((entry) => ({
    ...entry,
    specifiers: entry.specifiers.map((spec) => ({ ...spec, useRanges: [] })),
  }));
  const statementCells = collectStatementCells(
    ast,
    input,
    prefix,
    imports,
    exportsLocal,
    conditionalBindingCells,
    generate,
    traverse,
    options.sourceMap,
  );
  const cells = [...conditionalBindingCells, ...statementCells].sort(
    (left, right) => left.sourceOrder - right.sourceOrder,
  );
  const fileRecord: FileRecord = {
    id: moduleIdentity,
    moduleIdentity,
    filePath: input.canonicalPath ?? moduleIdentity,
    prefix,
    contentHash: contentHash(input.code),
    envs: ["default"],
    codeByEnv: {},
    mapByEnv: {},
    pkg: {
      name: input.pkg.name,
      version: input.pkg.version,
      root: ".",
    },
    imports,
    reexportsNamed,
    exportStars,
    exportsLocal,
    flags: {
      hasTopLevelAwait,
      sideEffects: true,
      needsNamespaceObject: importMeta.needsNamespaceObject,
    },
    conditionalImports: importMeta.conditionalImports,
    discoveredEntrypoints: [],
    cells,
    importRanges: [],
    exportRanges: [],
  };

  return {
    code: transformedCode,
    map: output?.map ? JSON.stringify(output.map) : undefined,
    fileRecord,
    meta: {
      imports,
      exportsLocal,
      exportStars,
      reexportsNamed,
      conditionalImports: importMeta.conditionalImports,
      discoveredEntrypoints: [],
      importRanges: [],
      exportRanges: [],
      flags: {
        hasTopLevelAwait,
        sideEffects: true,
        needsNamespaceObject: importMeta.needsNamespaceObject,
      },
    },
  };
}

function collectImports(
  ast: t.File,
  input: TransformInput,
  options: CoreTransformOptions,
  traverse: typeof import("@babel/traverse").default,
): {
  imports: ImportEntry[];
  conditionalImports: ConditionalImport[];
  needsNamespaceObject: boolean;
} {
  const imports: ImportEntry[] = [];
  const conditionalImports: ConditionalImport[] = [];
  let needsNamespaceObject = false;

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const request = path.node.source.value;
      const attributes = readImportAttributes(path.node);
      const typeAttr = attributes.type;
      if (typeAttr && !options.importAttrAllow.includes(typeAttr)) {
        throw new Error(
          `E_IMPORT_ATTRS: Unsupported import attribute type '${typeAttr}' at ${input.realPath}`,
        );
      }

      const conditionAttr = attributes.condition;
      const elseAttr = attributes.else;
      const resolved = resolveImportForHash(
        input,
        request,
        conditionAttr ? "conditional-import" : "import",
        attributes,
      );
      let condition: ConditionalImport | undefined;
      if (conditionAttr) {
        const conditionExpr = parseCondition(conditionAttr);
        const elseResolved = elseAttr
          ? resolveImportForHash(
              input,
              elseAttr,
              "conditional-else",
              Object.fromEntries(
                Object.entries(attributes).filter(
                  ([key]) => key !== "condition" && key !== "else",
                ),
              ),
            )
          : undefined;
        condition = {
          source: resolved.relPath,
          request,
          target: resolved.target,
          condition: conditionExpr,
          elseSource: elseResolved?.relPath,
          elseRequest: elseAttr,
          elseTarget: elseResolved?.target,
        };
        conditionalImports.push(condition);
      }

      const specifiers: ImportSpecifier[] = [];
      let isNamespace = false;
      let isDefault = false;
      let isTypeOnly = path.node.importKind === "type";

      for (const spec of path.node.specifiers) {
        const importKind = (spec as t.ImportSpecifier).importKind;
        if (importKind === "type") {
          isTypeOnly = true;
        }
        if (t.isImportNamespaceSpecifier(spec)) {
          isNamespace = true;
          specifiers.push({
            imported: "*",
            local: spec.local.name,
            useRanges: [],
          });
        }
        if (t.isImportDefaultSpecifier(spec)) {
          isDefault = true;
          specifiers.push({
            imported: "default",
            local: spec.local.name,
            useRanges: [],
          });
        }
        if (t.isImportSpecifier(spec)) {
          const imported = t.isIdentifier(spec.imported)
            ? spec.imported.name
            : t.isStringLiteral(spec.imported)
              ? spec.imported.value
              : "";
          specifiers.push({ imported, local: spec.local.name, useRanges: [] });
        }
      }

      const kind =
        specifiers.length === 0 ? "side-effect" : isTypeOnly ? "type" : "value";
      imports.push({
        source: resolved.relPath,
        request,
        target: resolved.target,
        kind,
        isNamespace,
        isDefault,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        specifiers,
        condition: condition?.condition,
      });
    },
  });

  const programPath = getProgramPath(ast, traverse);
  if (programPath) {
    for (const entry of imports) {
      if (entry.isNamespace) {
        const namespaceLocal = entry.specifiers[0]?.local;
        if (!namespaceLocal) {
          continue;
        }
        const binding = programPath.scope.getBinding(namespaceLocal);
        if (!binding) {
          continue;
        }
        const propertyRanges = new Map<string, Array<[number, number]>>();
        let isDynamic = false;
        const identifierRanges: Array<[number, number]> = [];
        for (const refPath of binding.referencePaths) {
          const parent = refPath.parentPath;
          if (
            parent &&
            parent.isMemberExpression() &&
            parent.node.object === refPath.node &&
            !parent.node.computed &&
            t.isIdentifier(parent.node.property)
          ) {
            if (isAssignmentTarget(parent)) {
              isDynamic = true;
            } else {
              const prop = parent.node.property.name;
              const start = parent.node.start ?? 0;
              const end = parent.node.end ?? 0;
              const list = propertyRanges.get(prop) ?? [];
              list.push([start, end]);
              propertyRanges.set(prop, list);
            }
          } else {
            isDynamic = true;
          }
          if (refPath.node.start != null && refPath.node.end != null) {
            identifierRanges.push([refPath.node.start, refPath.node.end]);
          }
        }

        if (isDynamic) {
          needsNamespaceObject = true;
          entry.namespaceUsage = "dynamic";
          entry.specifiers = [
            {
              imported: "*",
              local: namespaceLocal,
              useRanges: identifierRanges,
            },
          ];
        } else {
          entry.namespaceUsage = "static";
          const specifiers: ImportSpecifier[] = [];
          for (const [prop, ranges] of propertyRanges.entries()) {
            specifiers.push({
              imported: prop,
              local: namespaceLocal,
              useRanges: ranges,
            });
          }
          entry.specifiers = specifiers;
        }
        continue;
      }

      for (const spec of entry.specifiers) {
        const binding = programPath.scope.getBinding(spec.local);
        if (!binding) {
          continue;
        }
        for (const refPath of binding.referencePaths) {
          if (!refPath.isReferencedIdentifier()) {
            continue;
          }
          if (refPath.node.start != null && refPath.node.end != null) {
            spec.useRanges.push([refPath.node.start, refPath.node.end]);
          }
        }
      }
    }
  }

  return { imports, conditionalImports, needsNamespaceObject };
}

function buildConditionalBindingCells(
  imports: ImportEntry[],
  conditionalImports: ConditionalImport[],
  input: TransformInput,
  prefix: string,
): CellRecord[] {
  const moduleIdentity = transformModuleIdentity(input);
  const cells: CellRecord[] = [];
  let sourceOrder = -1000;

  for (const entry of imports) {
    if (!entry.condition || entry.target.kind === "runtime") {
      continue;
    }
    const resolved = resolveImportForHash(
      input,
      entry.request ?? entry.source,
      "conditional-import",
      entry.attributes ?? undefined,
    );
    const depPrefix = resolvedImportPrefix(resolved);
    const conditionalImport = conditionalImports.find(
      (item) =>
        item.source === entry.source &&
        JSON.stringify(item.condition) === JSON.stringify(entry.condition),
    );

    if (entry.isNamespace) {
      const namespaceLocal = entry.specifiers[0]?.local;
      if (!namespaceLocal) {
        continue;
      }
      const localName = `${prefix}_${namespaceLocal}`;
      const lines = [
        ...(input.dev?.hmr ? [] : [`let ${localName};`]),
        emitConditionalStart(entry.condition),
        `${localName} = __NS__${depPrefix};`,
        emitConditionalEnd(),
      ];

      let fallback = "undefined";
      const externalDeps: CellExternalDep[] = [
        {
          kind: "import",
          source: entry.source,
          request: entry.request,
          target: entry.target,
          imported: "*",
        },
      ];
      if (
        conditionalImport?.elseSource &&
        conditionalImport.elseTarget?.kind === "file"
      ) {
        const elseResolved = resolveImportForHash(
          input,
          conditionalImport.elseRequest ?? conditionalImport.elseSource,
          "conditional-else",
          withoutConditionalAttributes(entry.attributes ?? undefined),
        );
        const elsePrefix = resolvedImportPrefix(elseResolved);
        fallback = `__NS__${elsePrefix}`;
        externalDeps.push({
          kind: "import",
          source: conditionalImport.elseSource,
          request: conditionalImport.elseRequest,
          target: conditionalImport.elseTarget,
          imported: "*",
        });
      }
      lines.push(
        emitConditionalStart({ NOT: entry.condition }),
        `${localName} = ${fallback};`,
        emitConditionalEnd(),
      );
      cells.push({
        id: `${moduleIdentity}#cond:${sourceOrder}`,
        fileId: moduleIdentity,
        sourceOrder,
        kind: "conditional",
        code: lines.join("\n"),
        provides: [localName],
        internalDeps: [],
        externalDeps,
        eager: false,
      });
      sourceOrder += 1;
      continue;
    }

    for (const spec of entry.specifiers) {
      const localName = `${prefix}_${spec.local}`;
      const lines = [
        ...(input.dev?.hmr ? [] : [`let ${localName};`]),
        emitConditionalStart(entry.condition),
        `${localName} = ${conditionalImportTarget(entry, spec, depPrefix)};`,
        emitConditionalEnd(),
      ];

      let fallback = "undefined";
      const externalDeps: CellExternalDep[] = [
        {
          kind: "import",
          source: entry.source,
          request: entry.request,
          target: entry.target,
          imported: spec.imported,
        },
      ];
      if (
        conditionalImport?.elseSource &&
        conditionalImport.elseTarget?.kind === "file"
      ) {
        const elseResolved = resolveImportForHash(
          input,
          conditionalImport.elseRequest ?? conditionalImport.elseSource,
          "conditional-else",
          withoutConditionalAttributes(entry.attributes ?? undefined),
        );
        const elsePrefix = resolvedImportPrefix(elseResolved);
        fallback = conditionalImportTarget(entry, spec, elsePrefix);
        externalDeps.push({
          kind: "import",
          source: conditionalImport.elseSource,
          request: conditionalImport.elseRequest,
          target: conditionalImport.elseTarget,
          imported: spec.imported,
        });
      }
      lines.push(
        emitConditionalStart({ NOT: entry.condition }),
        `${localName} = ${fallback};`,
        emitConditionalEnd(),
      );
      cells.push({
        id: `${moduleIdentity}#cond:${sourceOrder}`,
        fileId: moduleIdentity,
        sourceOrder,
        kind: "conditional",
        code: lines.join("\n"),
        provides: [localName],
        internalDeps: [],
        externalDeps,
        eager: false,
      });
      sourceOrder += 1;
    }
  }
  return cells;
}

function rewriteImportsInAst(
  ast: t.File,
  input: TransformInput,
  prefix: string,
  imports: ImportEntry[],
  traverse: typeof import("@babel/traverse").default,
): void {
  const programPath = getProgramPath(ast, traverse);
  if (!programPath) {
    return;
  }

  for (const entry of imports) {
    if (entry.kind !== "value" || entry.target.kind === "runtime") {
      continue;
    }

    const resolved = resolveImportForHash(
      input,
      entry.request ?? entry.source,
      entry.condition ? "conditional-import" : "import",
      entry.attributes ?? undefined,
    );
    const depPrefix = resolvedImportPrefix(resolved);

    if (entry.isNamespace) {
      const namespaceLocal = entry.specifiers[0]?.local;
      if (!namespaceLocal) {
        continue;
      }
      const binding = programPath.scope.getBinding(namespaceLocal);
      if (!binding) {
        continue;
      }
      const targetName = entry.condition
        ? `${prefix}_${namespaceLocal}`
        : `__NS__${depPrefix}`;
      for (const refPath of binding.referencePaths) {
        if (!refPath.isReferencedIdentifier()) {
          continue;
        }
        const parent = refPath.parentPath;
        if (
          !entry.condition &&
          entry.namespaceUsage === "static" &&
          parent &&
          parent.isMemberExpression() &&
          parent.node.object === refPath.node &&
          !parent.node.computed &&
          t.isIdentifier(parent.node.property)
        ) {
          parent.replaceWith(
            t.identifier(`${depPrefix}_${parent.node.property.name}`),
          );
          continue;
        }
        refPath.replaceWith(t.identifier(targetName));
      }
      continue;
    }

    for (const spec of entry.specifiers) {
      const binding = programPath.scope.getBinding(spec.local);
      if (!binding) {
        continue;
      }
      const importName =
        spec.imported === "default" ? "default" : spec.imported;
      const targetName = entry.condition
        ? `${prefix}_${spec.local}`
        : `${depPrefix}_${importName}`;
      for (const refPath of binding.referencePaths) {
        if (!refPath.isReferencedIdentifier()) {
          continue;
        }
        refPath.replaceWith(t.identifier(targetName));
      }
    }
  }
}

type StatementCellDraft = Omit<
  CellRecord,
  "code" | "map" | "artifactPath" | "mapArtifactPath"
> & {
  statements: Array<t.Statement | t.ModuleDeclaration>;
  endSourceOrder: number;
};

function collectStatementCells(
  ast: t.File,
  input: TransformInput,
  prefix: string,
  imports: ImportEntry[],
  exportsLocal: ExportLocal[],
  conditionalCells: CellRecord[],
  generate: typeof import("@babel/generator").default,
  traverse: typeof import("@babel/traverse").default,
  sourceMap: CoreTransformOptions["sourceMap"],
): CellRecord[] {
  const moduleIdentity = transformModuleIdentity(input);
  const programPath = getProgramPath(ast, traverse);
  if (!programPath) {
    return [];
  }

  const internalSymbols = new Set<string>();
  for (const statement of programPath.node.body) {
    for (const symbol of collectDeclaredTopLevelSymbols(statement)) {
      internalSymbols.add(symbol);
    }
  }
  for (const cell of conditionalCells) {
    for (const symbol of cell.provides) {
      internalSymbols.add(symbol);
    }
  }

  const externalSymbolMap = createExternalSymbolMap(imports, input, prefix);
  const exportSymbols = new Set(
    exportsLocal.map(
      (entry) =>
        `${prefix}_${entry.local === "default" ? "default" : entry.local}`,
    ),
  );

  const drafts: StatementCellDraft[] = programPath
    .get("body")
    .map((statementPath, index) => {
      const statement = statementPath.node as t.Statement | t.ModuleDeclaration;
      const provides = collectDeclaredTopLevelSymbols(statement);
      const { internalDeps, externalDeps } = collectStatementDeps(
        statementPath as NodePath<t.Statement | t.ModuleDeclaration>,
        new Set(provides),
        internalSymbols,
        externalSymbolMap,
      );
      return {
        id: `${moduleIdentity}#stmt:${index}`,
        fileId: moduleIdentity,
        sourceOrder: index,
        endSourceOrder: index,
        kind: "worker",
        statements: [statement],
        provides,
        internalDeps,
        externalDeps,
        eager: isEagerStatement(statement, exportSymbols),
      };
    });

  return mergeAdjacentStatementCells(drafts).map((draft) => {
    const statements = input.dev?.hmr
      ? lowerHmrCellStatements(draft.statements)
      : draft.statements;
    const generated = generate(
      t.program(statements),
      {
        sourceMaps: Boolean(sourceMap),
        sourceFileName: sourceMap?.sourceFileName ?? input.realPath,
        shouldPrintComment: shouldPrintSourceComment,
      },
      sourceMap && optionsEmbedCellSourcesContent(sourceMap)
        ? input.code
        : undefined,
    );
    const generatedMap = generated.map as
      | (Record<string, unknown> & { sourcesContent?: unknown })
      | null;
    if (
      generatedMap &&
      sourceMap &&
      (!sourceMap.sourcesContent || !optionsEmbedCellSourcesContent(sourceMap))
    ) {
      delete generatedMap.sourcesContent;
    }
    return {
      id: draft.id,
      fileId: draft.fileId,
      sourceOrder: draft.sourceOrder,
      kind: draft.kind,
      code: generated.code,
      map: generatedMap ? JSON.stringify(generatedMap) : undefined,
      provides: draft.provides,
      internalDeps: draft.internalDeps,
      externalDeps: draft.externalDeps,
      providerDeps: draft.providerDeps,
      eager: draft.eager,
    };
  });
}

function optionsEmbedCellSourcesContent(
  sourceMap: NonNullable<CoreTransformOptions["sourceMap"]>,
): boolean {
  return sourceMap.embedCellSourcesContent !== false;
}

function transformModuleIdentity(input: TransformInput): string {
  if (!input.moduleIdentity) {
    throw new Error(
      "A portable module identity is required for transformation.",
    );
  }
  return input.moduleIdentity;
}

function lowerHmrCellStatements(
  statements: Array<t.Statement | t.ModuleDeclaration>,
): Array<t.Statement | t.ModuleDeclaration> {
  return statements.flatMap((statement) => {
    if (t.isVariableDeclaration(statement)) {
      const assignments = statement.declarations.flatMap((declaration) => {
        if (!declaration.init || t.isVoidPattern(declaration.id)) {
          return [];
        }
        const assignment = t.assignmentExpression(
          "=",
          t.cloneNode(declaration.id, true),
          t.cloneNode(declaration.init, true),
        );
        t.inherits(assignment, declaration);
        return [assignment];
      });
      if (assignments.length === 0) {
        return [];
      }
      const expression =
        assignments.length === 1
          ? assignments[0]
          : t.sequenceExpression(assignments);
      const lowered = t.expressionStatement(expression);
      t.inherits(lowered, statement);
      return [lowered];
    }
    if (
      (t.isFunctionDeclaration(statement) || t.isClassDeclaration(statement)) &&
      statement.id
    ) {
      const declaration = t.cloneNode(statement, true);
      const expression = t.isFunctionDeclaration(declaration)
        ? t.functionExpression(
            null,
            declaration.params,
            declaration.body,
            declaration.generator,
            declaration.async,
          )
        : t.toExpression(declaration);
      const assignment = t.assignmentExpression(
        "=",
        t.cloneNode(statement.id, true),
        expression,
      );
      t.inherits(assignment, statement);
      const lowered = t.expressionStatement(assignment);
      t.inherits(lowered, statement);
      return [lowered];
    }
    return [statement];
  });
}

function mergeAdjacentStatementCells(
  cells: StatementCellDraft[],
): StatementCellDraft[] {
  const merged: StatementCellDraft[] = [];

  for (const cell of cells) {
    const previous = merged.at(-1);
    if (!previous || !shouldMergeIntoPrevious(previous, cell)) {
      merged.push({ ...cell });
      continue;
    }

    const previousProvides = new Set(previous.provides);
    previous.statements.push(...cell.statements);
    previous.provides = dedupeStrings([...previous.provides, ...cell.provides]);
    previous.internalDeps = dedupeStrings([
      ...previous.internalDeps,
      ...cell.internalDeps.filter((dep) => !previousProvides.has(dep)),
    ]);
    previous.externalDeps = dedupeExternalDeps([
      ...previous.externalDeps,
      ...cell.externalDeps,
    ]);
    previous.eager = previous.eager || cell.eager;
    previous.endSourceOrder = cell.sourceOrder;
  }

  return merged;
}

function shouldMergeIntoPrevious(
  previous: StatementCellDraft,
  current: StatementCellDraft,
): boolean {
  if (!current.eager) {
    return false;
  }
  if (current.sourceOrder !== previous.endSourceOrder + 1) {
    return false;
  }
  const previousProvides = new Set(previous.provides);
  return current.internalDeps.some((dep) => previousProvides.has(dep));
}

function shouldPrintSourceComment(comment: string): boolean {
  return !/[@#]\s*sourceMappingURL\s*=/.test(comment);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function dedupeExternalDeps(values: CellExternalDep[]): CellExternalDep[] {
  const deduped = new Map<string, CellExternalDep>();
  for (const value of values) {
    deduped.set(JSON.stringify(value), value);
  }
  return Array.from(deduped.values());
}

function createExternalSymbolMap(
  imports: ImportEntry[],
  input: TransformInput,
  prefix: string,
): Map<string, CellExternalDep> {
  const externalSymbols = new Map<string, CellExternalDep>();

  for (const entry of imports) {
    if (
      entry.kind !== "value" ||
      entry.condition ||
      entry.target.kind === "runtime"
    ) {
      continue;
    }
    const resolved = resolveImportForHash(
      input,
      entry.request ?? entry.source,
      "import",
      entry.attributes ?? undefined,
    );
    const depPrefix = resolvedImportPrefix(resolved);

    if (entry.isNamespace) {
      if (entry.namespaceUsage === "dynamic") {
        externalSymbols.set(`__NS__${depPrefix}`, {
          kind: "import",
          source: entry.source,
          request: entry.request,
          target: entry.target,
          imported: "*",
        });
        continue;
      }

      for (const spec of entry.specifiers) {
        externalSymbols.set(`${depPrefix}_${spec.imported}`, {
          kind: "import",
          source: entry.source,
          request: entry.request,
          target: entry.target,
          imported: spec.imported,
        });
      }
      continue;
    }

    for (const spec of entry.specifiers) {
      const importName =
        spec.imported === "default" ? "default" : spec.imported;
      externalSymbols.set(`${depPrefix}_${importName}`, {
        kind: "import",
        source: entry.source,
        request: entry.request,
        target: entry.target,
        imported: importName,
      });
    }
  }

  for (const entry of imports) {
    if (
      entry.kind === "side-effect" &&
      !entry.condition &&
      entry.target.kind === "file"
    ) {
      externalSymbols.set(`${prefix}#side-effect:${entry.source}`, {
        kind: "side-effect",
        source: entry.source,
        request: entry.request,
        target: entry.target,
      });
    }
  }

  return externalSymbols;
}

function collectStatementDeps(
  statementPath: NodePath<t.Statement | t.ModuleDeclaration>,
  providedSymbols: Set<string>,
  internalSymbols: Set<string>,
  externalSymbols: Map<string, CellExternalDep>,
): {
  internalDeps: string[];
  externalDeps: CellExternalDep[];
} {
  const internalDeps = new Set<string>();
  const externalDeps = new Map<string, CellExternalDep>();
  const programScope = statementPath.scope.getProgramParent();

  statementPath.traverse({
    ReferencedIdentifier(path) {
      if (!path.isIdentifier()) {
        return;
      }
      const name = path.node.name;
      const binding = path.scope.getBinding(name);
      if (binding) {
        if (
          binding.scope === programScope &&
          internalSymbols.has(name) &&
          !providedSymbols.has(name)
        ) {
          internalDeps.add(name);
        }
        return;
      }
      if (internalSymbols.has(name)) {
        internalDeps.add(name);
        return;
      }
      const external = externalSymbols.get(name);
      if (external) {
        externalDeps.set(JSON.stringify(external), external);
      }
    },
  });

  return {
    internalDeps: Array.from(internalDeps),
    externalDeps: Array.from(externalDeps.values()),
  };
}

function collectDeclaredTopLevelSymbols(
  statement: t.Statement | t.ModuleDeclaration,
): string[] {
  if (t.isFunctionDeclaration(statement) && statement.id) {
    return [statement.id.name];
  }
  if (t.isClassDeclaration(statement) && statement.id) {
    return [statement.id.name];
  }
  if (t.isVariableDeclaration(statement)) {
    const symbols: string[] = [];
    for (const declaration of statement.declarations) {
      collectPatternIdentifiers(declaration.id, symbols);
    }
    return symbols;
  }
  return [];
}

function collectPatternIdentifiers(
  pattern: t.LVal | t.VoidPattern,
  out: string[],
): void {
  if (t.isVoidPattern(pattern)) {
    return;
  }
  if (t.isIdentifier(pattern)) {
    out.push(pattern.name);
    return;
  }
  if (t.isObjectPattern(pattern)) {
    for (const property of pattern.properties) {
      if (t.isObjectProperty(property)) {
        if (t.isLVal(property.value) || t.isVoidPattern(property.value)) {
          collectPatternIdentifiers(property.value, out);
        }
      } else if (t.isRestElement(property)) {
        collectPatternIdentifiers(property.argument, out);
      }
    }
    return;
  }
  if (t.isArrayPattern(pattern)) {
    for (const element of pattern.elements) {
      if (element && (t.isLVal(element) || t.isVoidPattern(element))) {
        collectPatternIdentifiers(element, out);
      }
    }
    return;
  }
  if (t.isAssignmentPattern(pattern)) {
    collectPatternIdentifiers(pattern.left, out);
    return;
  }
  if (t.isRestElement(pattern)) {
    collectPatternIdentifiers(pattern.argument, out);
  }
}

function isEagerStatement(
  statement: t.Statement | t.ModuleDeclaration,
  exportSymbols: Set<string>,
): boolean {
  if (t.isFunctionDeclaration(statement) || t.isClassDeclaration(statement)) {
    return false;
  }

  if (t.isVariableDeclaration(statement) && statement.kind === "const") {
    const declared = collectDeclaredTopLevelSymbols(statement);
    if (
      declared.length > 0 &&
      declared.every((symbol) => exportSymbols.has(symbol)) &&
      statement.declarations.every((declaration) =>
        declaration.init ? isSafeInitializer(declaration.init) : true,
      )
    ) {
      return false;
    }
    if (
      declared.length > 0 &&
      statement.declarations.every((declaration) =>
        declaration.init ? isSafeInitializer(declaration.init) : true,
      )
    ) {
      return false;
    }
  }

  return true;
}

function isSafeInitializer(expression: t.Expression): boolean {
  if (
    t.isIdentifier(expression) ||
    t.isStringLiteral(expression) ||
    t.isNumericLiteral(expression) ||
    t.isBooleanLiteral(expression) ||
    t.isNullLiteral(expression) ||
    t.isBigIntLiteral(expression) ||
    t.isRegExpLiteral(expression) ||
    t.isArrowFunctionExpression(expression) ||
    t.isFunctionExpression(expression) ||
    t.isClassExpression(expression)
  ) {
    return true;
  }
  if (t.isTemplateLiteral(expression)) {
    return expression.expressions.every(
      (item) => t.isExpression(item) && isSafeInitializer(item),
    );
  }
  if (t.isArrayExpression(expression)) {
    return expression.elements.every((item) =>
      item == null
        ? true
        : t.isSpreadElement(item)
          ? false
          : isSafeInitializer(item),
    );
  }
  if (t.isObjectExpression(expression)) {
    return expression.properties.every((property) => {
      if (t.isSpreadElement(property)) {
        return false;
      }
      if (t.isObjectMethod(property)) {
        return true;
      }
      return isSafeInitializer(property.value as t.Expression);
    });
  }
  if (t.isUnaryExpression(expression)) {
    return isSafeInitializer(expression.argument as t.Expression);
  }
  if (t.isBinaryExpression(expression) || t.isLogicalExpression(expression)) {
    return (
      isSafeInitializer(expression.left as t.Expression) &&
      isSafeInitializer(expression.right as t.Expression)
    );
  }
  if (t.isConditionalExpression(expression)) {
    return (
      isSafeInitializer(expression.test) &&
      isSafeInitializer(expression.consequent) &&
      isSafeInitializer(expression.alternate)
    );
  }
  if (t.isSequenceExpression(expression)) {
    return expression.expressions.every((item) => isSafeInitializer(item));
  }
  if (t.isMemberExpression(expression)) {
    return (
      t.isIdentifier(expression.object) &&
      (!expression.computed ||
        (expression.property != null &&
          t.isExpression(expression.property) &&
          isSafeInitializer(expression.property)))
    );
  }
  return false;
}

function removeImportDeclarations(
  input: TransformInput,
  ast: t.File,
  traverse: typeof import("@babel/traverse").default,
): void {
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const attributes = readImportAttributes(path.node);
      const resolved = resolveImportForHash(
        input,
        path.node.source.value,
        attributes.condition ? "conditional-import" : "import",
        attributes,
      );
      if (resolved.target.kind === "file") {
        path.remove();
      }
    },
  });
}

function resolveImportForHash(
  input: TransformInput,
  source: string,
  kind:
    | "import"
    | "dynamic-import"
    | "reexport"
    | "conditional-import"
    | "conditional-else",
  importAttributes?: Record<string, string>,
): ResolvedImportInfo {
  const resolution =
    input.resolvedImports?.[
      toImportResolutionKey(kind, source, importAttributes)
    ];
  if (!resolution) {
    throw new Error(
      `Missing resolved dependency '${source}' for '${input.moduleIdentity ?? input.canonicalPath ?? "module"}'.`,
    );
  }
  if (resolution.target.kind === "runtime") {
    return {
      source,
      request: source,
      prefixModuleId: null,
      target: resolution.target,
      pkg: input.pkg,
      relPath: source,
    };
  }
  const parsed = parseCanonicalPath(resolution.target.canonicalPath);
  return {
    source: parsed.relativePath,
    request: source,
    prefixModuleId: resolution.target.moduleId,
    target: resolution.target,
    pkg: { ...parsed.pkg, root: "." },
    relPath: parsed.relativePath,
  };
}

function parseCanonicalPath(canonicalPath: string): {
  pkg: { name: string; version: string };
  relativePath: string;
} {
  const separator = canonicalPath.indexOf("::");
  const packagePart = separator === -1 ? "" : canonicalPath.slice(0, separator);
  const versionSeparator = packagePart.lastIndexOf("@");
  if (separator === -1 || versionSeparator < 0) {
    throw new Error(
      `Invalid canonical dependency identity '${canonicalPath}'.`,
    );
  }
  return {
    pkg: {
      name: packagePart.slice(0, versionSeparator),
      version: packagePart.slice(versionSeparator + 1),
    },
    relativePath: canonicalPath.slice(separator + 2),
  };
}

function toImportResolutionKey(
  kind:
    | "import"
    | "dynamic-import"
    | "reexport"
    | "conditional-import"
    | "conditional-else",
  request: string,
  importAttributes?: Record<string, string>,
): string {
  const attributes = importAttributes
    ? Object.entries(importAttributes).sort(([left], [right]) =>
        left.localeCompare(right),
      )
    : [];
  return `${kind}:${request}${
    attributes.length > 0 ? `:attributes=${JSON.stringify(attributes)}` : ""
  }`;
}

function withoutConditionalAttributes(
  attributes: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!attributes) return undefined;
  const filtered = Object.fromEntries(
    Object.entries(attributes).filter(
      ([key]) => key !== "condition" && key !== "else",
    ),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function isImportMetaUrl(node: t.MemberExpression): boolean {
  return (
    t.isMetaProperty(node.object) &&
    node.object.meta.name === "import" &&
    node.object.property.name === "meta" &&
    t.isIdentifier(node.property, { name: "url" })
  );
}

function isImportMetaHot(node: t.MemberExpression): boolean {
  return (
    t.isMetaProperty(node.object) &&
    node.object.meta.name === "import" &&
    node.object.property.name === "meta" &&
    t.isIdentifier(node.property, { name: "hot" })
  );
}

function readImportAttributes(
  node: t.ImportDeclaration,
): Record<string, string> {
  const attributes =
    node.attributes ??
    (node as t.ImportDeclaration & { assertions?: t.ImportAttribute[] })
      .assertions;
  if (!attributes) {
    return {};
  }
  return attributes.reduce<Record<string, string>>((acc, attr) => {
    if (
      t.isImportAttribute(attr) &&
      (t.isIdentifier(attr.key) || t.isStringLiteral(attr.key)) &&
      t.isStringLiteral(attr.value)
    ) {
      acc[t.isIdentifier(attr.key) ? attr.key.name : attr.key.value] =
        attr.value.value;
    }
    return acc;
  }, {});
}

function foldBuildTimeImportConditions(
  ast: t.File,
  environmentVariables: Readonly<Record<string, string>>,
  realPath: string,
): void {
  const names = Object.keys(environmentVariables);
  const traverse = ((
    traverseModule as unknown as {
      default?: typeof import("@babel/traverse").default;
    }
  ).default ??
    (traverseModule as unknown as typeof import("@babel/traverse").default)) as typeof import("@babel/traverse").default;

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const attributes = readImportAttributes(path.node);
      const buildConditionNames = names.filter((name) =>
        Object.prototype.hasOwnProperty.call(attributes, name),
      );
      if (buildConditionNames.length === 0) {
        if (attributes.else && !attributes.condition) {
          throw new Error(
            `E_BUILD_CONDITION: Import 'else' at ${realPath} requires either a runtime condition or a configured environment-variable attribute.`,
          );
        }
        return;
      }
      if (attributes.condition) {
        throw new Error(
          `E_BUILD_CONDITION: Import at ${realPath} cannot mix runtime and build-time conditions.`,
        );
      }

      const matches = buildConditionNames.every(
        (name) => attributes[name] === environmentVariables[name],
      );
      if (!matches && !attributes.else) {
        if (path.node.specifiers.length > 0) {
          throw new Error(
            `E_BUILD_CONDITION: A build-time conditional value import at ${realPath} requires an 'else' branch.`,
          );
        }
        path.remove();
        return;
      }

      if (!matches) {
        path.node.source = t.stringLiteral(attributes.else!);
      }
      const removedNames = new Set([...buildConditionNames, "else"]);
      const importAttributes =
        path.node.attributes ??
        (
          path.node as t.ImportDeclaration & {
            assertions?: t.ImportAttribute[];
          }
        ).assertions ??
        [];
      path.node.attributes = importAttributes.filter((attribute) => {
        if (!t.isImportAttribute(attribute)) return true;
        const key = t.isIdentifier(attribute.key)
          ? attribute.key.name
          : t.isStringLiteral(attribute.key)
            ? attribute.key.value
            : undefined;
        return key == null || !removedNames.has(key);
      });
      (
        path.node as t.ImportDeclaration & {
          assertions?: t.ImportAttribute[];
        }
      ).assertions = undefined;
    },
  });
}

function parseCondition(value: string): ConditionalImport["condition"] {
  try {
    return JSON.parse(value) as ConditionalImport["condition"];
  } catch {
    return value;
  }
}

function getProgramPath(
  ast: t.File,
  traverse: typeof import("@babel/traverse").default,
): NodePath<t.Program> | null {
  let programPath: NodePath<t.Program> | null = null;
  traverse(ast, {
    Program(path: NodePath<t.Program>) {
      programPath = path;
      path.stop();
    },
  });
  return programPath;
}

function isAssignmentTarget(memberPath: NodePath<t.MemberExpression>): boolean {
  const parent = memberPath.parentPath;
  if (!parent) {
    return false;
  }
  if (parent.isAssignmentExpression() && parent.node.left === memberPath.node) {
    return true;
  }
  if (parent.isUpdateExpression()) {
    return true;
  }
  return false;
}

function conditionalImportTarget(
  entry: ImportEntry,
  spec: ImportSpecifier,
  depPrefix: string,
): string {
  if (entry.isNamespace) {
    return `__NS__${depPrefix}`;
  }
  const importName = spec.imported === "default" ? "default" : spec.imported;
  return `${depPrefix}_${importName}`;
}

function emitConditionalStart(
  condition: ConditionalImport["condition"],
): string {
  return `/////##CONDITION_START##${JSON.stringify(condition)}`;
}

function emitConditionalEnd(): string {
  return "/////##CONDITION_END##";
}

function exportDefaultToExpression(
  declaration: t.Declaration | t.Expression,
): t.Expression {
  if (t.isFunctionDeclaration(declaration)) {
    return t.functionExpression(
      declaration.id,
      declaration.params,
      declaration.body,
      declaration.generator,
      declaration.async,
    );
  }
  if (t.isClassDeclaration(declaration)) {
    return t.classExpression(
      declaration.id,
      declaration.superClass,
      declaration.body,
      declaration.decorators || [],
    );
  }
  if (t.isTSDeclareFunction(declaration)) {
    return t.functionExpression(
      declaration.id,
      declaration.params,
      t.blockStatement([]),
      false,
      false,
    );
  }
  if (t.isExpression(declaration)) {
    return declaration;
  }
  return t.identifier("undefined");
}

function renameModuleBinding(
  binding: Binding,
  oldName: string,
  newName: string,
): void {
  if (binding.identifier.name === newName) {
    return;
  }
  binding.identifier.name = newName;
  for (const refPath of binding.referencePaths) {
    if (!refPath.isIdentifier()) {
      continue;
    }
    if (refPath.node.name === newName) {
      continue;
    }
    const parent = refPath.parentPath;
    if (
      parent?.isObjectProperty() &&
      parent.node.shorthand &&
      parent.node.value === refPath.node
    ) {
      parent.node.shorthand = false;
      if (parent.node.key === refPath.node) {
        parent.node.key = t.identifier(oldName);
      }
      if (parent.node.extra?.shorthand) {
        parent.node.extra.shorthand = false;
      }
    }
    refPath.node.name = newName;
  }
  for (const violationPath of binding.constantViolations) {
    const identifiers = t.getAssignmentIdentifiers(violationPath.node);
    const identifier = identifiers[oldName];
    if (identifier) {
      identifier.name = newName;
    }
  }
}
