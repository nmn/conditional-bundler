import fs from "node:fs";
import path from "node:path";
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
  DynamicImport,
  ConditionalImport,
  CellRecord,
  FileRecord,
  CellExternalDep,
} from "@bundler/shared";
import {
  importConstKey,
  filePrefix,
  findPkgRoot,
  readPkgSafe,
  normalizePosixPath,
  contentHash,
} from "@bundler/shared";

export type CoreTransformOptions = {
  importAttrAllow: string[];
};

function getParserPlugins(input: TransformInput): ParserPlugin[] {
  const plugins: ParserPlugin[] = ["importAttributes"];
  if (input.syntax.ts) {
    plugins.push("typescript");
  }
  if (input.syntax.jsx) {
    plugins.push("jsx");
  }
  return plugins;
}

export function transformWithCore(
  input: TransformInput,
  options: CoreTransformOptions,
): TransformResult {
  const dynamicImportMap = new Map<string, { source: string; request: string }>();

  const ast = parse(input.code, {
    sourceType: "module",
    sourceFilename: input.realPath,
    plugins: getParserPlugins(input),
  });

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

  const normalizedPath = normalizePosixPath(input.realPath);
  const relPath = path.posix.relative(input.pkg.root, normalizedPath);
  const prefix = filePrefix(input.pkg.name, input.pkg.version, relPath);

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

  const declaredExportNames = new Set<string>();
  const importMeta = collectImports(ast, input, options, traverse);

  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      const decl = path.node.declaration;
      if (!decl) {
        return;
      }
      if (t.isFunctionDeclaration(decl) && decl.id) {
        declaredExportNames.add(decl.id.name);
      }
      if (t.isClassDeclaration(decl) && decl.id) {
        declaredExportNames.add(decl.id.name);
      }
      if (t.isVariableDeclaration(decl)) {
        for (const varDecl of decl.declarations) {
          if (t.isIdentifier(varDecl.id)) {
            declaredExportNames.add(varDecl.id.name);
          }
        }
      }
    },
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.id) {
        declaredExportNames.add(decl.id.name);
      }
      if (t.isClassDeclaration(decl) && decl.id) {
        declaredExportNames.add(decl.id.name);
      }
    },
  });

  const exportStars: ExportStar[] = [];
  const reexportsNamed: ReexportNamed[] = [];
  const exportsLocal: ExportLocal[] = [];
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
        if (binding.kind === "module" && isImportBinding) {
          continue;
        }
        const nextName = `${prefix}_${name}`;
        renameMap.set(name, nextName);
        renameReverse.set(nextName, name);
        if (declaredExportNames.has(name)) {
          renameModuleBinding(binding, nextName);
        } else {
          path.scope.rename(name, nextName);
        }
      }
    },
    Import(path: NodePath<t.Import>) {
      const parentPath = path.parentPath;
      const parent = parentPath.node;
      if (t.isCallExpression(parent) && parent.arguments.length === 1) {
        const arg = parent.arguments[0];
        if (t.isStringLiteral(arg)) {
          const resolved = resolveImportForHash(input, arg.value);
          const key = importConstKey(
            resolved.pkg.name,
            resolved.pkg.version,
            resolved.relPath,
          );
          dynamicImportMap.set(key, {
            source: resolved.relPath,
            request: arg.value,
          });
          parentPath.replaceWith(
            t.callExpression(t.identifier(`__IMPORT_${key}`), []),
          );
        }
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
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.source) {
        const request = path.node.source.value;
        const resolved = resolveImportForHash(input, request);
        const sourceOrder = path.node.start ?? 0;
        for (const spec of path.node.specifiers) {
          if (t.isExportNamespaceSpecifier(spec)) {
            const exported = spec.exported.name;
            reexportsNamed.push({
              source: resolved.relPath,
              request,
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
              imported,
              exported,
              sourceOrder,
            });
          }
        }
        path.remove();
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
            if (exported && originalLocal !== exported) {
              exportsLocal.push({ local: exported, exported, kind: "var" });
              declarations.push(
                t.variableDeclarator(
                  t.identifier(`${prefix}_${exported}`),
                  t.identifier(localRenamed),
                ),
              );
            } else {
              exportsLocal.push({ local: originalLocal, exported, kind: "var" });
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
      const resolved = resolveImportForHash(input, request);
      const exported = (
        path.node as t.ExportAllDeclaration & { exported?: t.Identifier }
      ).exported;
      const sourceOrder = path.node.start ?? 0;
      if (exported && t.isIdentifier(exported)) {
        reexportsNamed.push({
          source: resolved.relPath,
          request,
          imported: "*",
          exported: exported.name,
          isNamespace: true,
          sourceOrder,
        });
        path.remove();
        return;
      }
      exportStars.push({ source: resolved.relPath, request, sourceOrder });
      path.remove();
    },
  });

  rewriteImportsInAst(ast, input, prefix, importMeta.imports, traverse);
  removeImportDeclarations(ast, traverse);

  if (hasTopLevelAwait) {
    throw new Error(
      `E_TLA: Top-level 'await' is not supported (v1). at ${input.realPath}`,
    );
  }

  const output = generate(
    ast,
    { sourceMaps: true, sourceFileName: input.realPath },
    input.code,
  );
  const dynamicImports: DynamicImport[] = Array.from(
    dynamicImportMap.entries(),
  ).map(([hashKey, entry]) => ({
    hashKey: `__IMPORT_${hashKey}`,
    source: entry.source,
    request: entry.request,
  }));

  let transformedCode = output.code;
  const conditionalBindingCells = buildConditionalBindingCells(
    importMeta.imports,
    importMeta.conditionalImports,
    input,
    prefix,
  );
  if (conditionalBindingCells.length > 0) {
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
  );
  const cells = [...conditionalBindingCells, ...statementCells].sort(
    (left, right) => left.sourceOrder - right.sourceOrder,
  );
  const fileRecord: FileRecord = {
    id: input.realPath,
    prefix,
    contentHash: contentHash(input.code),
    envs: ["default"],
    codeByEnv: {},
    mapByEnv: {},
    pkg: input.pkg,
    imports,
    reexportsNamed,
    exportStars,
    exportsLocal,
    flags: {
      hasTopLevelAwait,
      sideEffects: true,
      needsNamespaceObject: importMeta.needsNamespaceObject,
    },
    dynamicImports,
    conditionalImports: importMeta.conditionalImports,
    discoveredEntrypoints: dynamicImports.map((entry) => entry.source),
    cells,
    importRanges: [],
    exportRanges: [],
  };

  return {
    code: transformedCode,
    map: output.map ? JSON.stringify(output.map) : undefined,
    fileRecord,
    meta: {
      imports,
      exportsLocal,
      exportStars,
      reexportsNamed,
      dynamicImports,
      conditionalImports: importMeta.conditionalImports,
      discoveredEntrypoints: dynamicImports.map((entry) => entry.source),
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
      const resolved = resolveImportForHash(input, request);
      const attributes = readImportAttributes(path.node);
      const typeAttr = attributes.type;
      if (typeAttr && typeAttr !== "json") {
        throw new Error(
          `E_IMPORT_ATTRS: Only { type: "json" } import attributes are supported (v1) at ${input.realPath}`,
        );
      }
      if (typeAttr === "json" && !options.importAttrAllow.includes("json")) {
        throw new Error(
          `E_IMPORT_ATTRS: Only { type: "json" } import attributes are supported (v1) at ${input.realPath}`,
        );
      }

      const conditionAttr = attributes.condition;
      const elseAttr = attributes.else;
      let condition: ConditionalImport | undefined;
      if (conditionAttr) {
        const conditionExpr = parseCondition(conditionAttr);
        const elseResolved = elseAttr
          ? resolveImportForHash(input, elseAttr)
          : undefined;
        condition = {
          source: resolved.relPath,
          request,
          condition: conditionExpr,
          elseSource: elseResolved?.relPath,
          elseRequest: elseAttr,
        };
        conditionalImports.push(condition);
        delete attributes.condition;
        delete attributes.else;
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
  const cells: CellRecord[] = [];
  let sourceOrder = -1000;

  for (const entry of imports) {
    if (!entry.condition) {
      continue;
    }
    const resolved = resolveImportForHash(input, entry.request ?? entry.source);
    const depPrefix = filePrefix(
      resolved.pkg.name,
      resolved.pkg.version,
      resolved.relPath,
    );
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
        emitConditionalStart(entry.condition),
        `const ${localName} = __NS__${depPrefix};`,
        emitConditionalEnd(),
      ];

      let fallback = "undefined";
      const externalDeps: CellExternalDep[] = [
        {
          kind: "import",
          source: entry.source,
          request: entry.request,
          imported: "*",
        },
      ];
      if (conditionalImport?.elseSource) {
        const elseResolved = resolveImportForHash(
          input,
          conditionalImport.elseRequest ?? conditionalImport.elseSource,
        );
        const elsePrefix = filePrefix(
          elseResolved.pkg.name,
          elseResolved.pkg.version,
          elseResolved.relPath,
        );
        fallback = `__NS__${elsePrefix}`;
        externalDeps.push({
          kind: "import",
          source: conditionalImport.elseSource,
          request: conditionalImport.elseRequest,
          imported: "*",
        });
      }
      lines.push(
        emitConditionalStart({ NOT: entry.condition }),
        `const ${localName} = ${fallback};`,
        emitConditionalEnd(),
      );
      cells.push({
        id: `${input.realPath}#cond:${sourceOrder}`,
        fileId: input.realPath,
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
        emitConditionalStart(entry.condition),
        `const ${localName} = ${conditionalImportTarget(entry, spec, depPrefix)};`,
        emitConditionalEnd(),
      ];

      let fallback = "undefined";
      const externalDeps: CellExternalDep[] = [
        {
          kind: "import",
          source: entry.source,
          request: entry.request,
          imported: spec.imported,
        },
      ];
      if (conditionalImport?.elseSource) {
        const elseResolved = resolveImportForHash(
          input,
          conditionalImport.elseRequest ?? conditionalImport.elseSource,
        );
        const elsePrefix = filePrefix(
          elseResolved.pkg.name,
          elseResolved.pkg.version,
          elseResolved.relPath,
        );
        fallback = conditionalImportTarget(entry, spec, elsePrefix);
        externalDeps.push({
          kind: "import",
          source: conditionalImport.elseSource,
          request: conditionalImport.elseRequest,
          imported: spec.imported,
        });
      }
      lines.push(
        emitConditionalStart({ NOT: entry.condition }),
        `const ${localName} = ${fallback};`,
        emitConditionalEnd(),
      );
      cells.push({
        id: `${input.realPath}#cond:${sourceOrder}`,
        fileId: input.realPath,
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
    if (entry.kind !== "value") {
      continue;
    }

    const resolved = resolveImportForHash(input, entry.request ?? entry.source);
    const depPrefix = filePrefix(
      resolved.pkg.name,
      resolved.pkg.version,
      resolved.relPath,
    );

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
      const importName = spec.imported === "default" ? "default" : spec.imported;
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

function collectStatementCells(
  ast: t.File,
  input: TransformInput,
  prefix: string,
  imports: ImportEntry[],
  exportsLocal: ExportLocal[],
  conditionalCells: CellRecord[],
  generate: typeof import("@babel/generator").default,
  traverse: typeof import("@babel/traverse").default,
): CellRecord[] {
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
    exportsLocal.map((entry) =>
      `${prefix}_${entry.local === "default" ? "default" : entry.local}`,
    ),
  );

  const cells: CellRecord[] = programPath.get("body").map((statementPath, index) => {
    const statement = statementPath.node as t.Statement;
    const provides = collectDeclaredTopLevelSymbols(statement);
    const { internalDeps, externalDeps } = collectStatementDeps(
      statementPath as NodePath<t.Statement>,
      new Set(provides),
      internalSymbols,
      externalSymbolMap,
    );
    const code = generate(statement, { sourceMaps: false }).code;

    return {
      id: `${input.realPath}#stmt:${index}`,
      fileId: input.realPath,
      sourceOrder: index,
      kind: "worker",
      code,
      provides,
      internalDeps,
      externalDeps,
      eager: isEagerStatement(statement, exportSymbols),
    };
  });

  return mergeAdjacentStatementCells(cells);
}

function mergeAdjacentStatementCells(cells: CellRecord[]): CellRecord[] {
  const merged: Array<CellRecord & { endSourceOrder: number }> = [];

  for (const cell of cells) {
    const previous = merged.at(-1);
    if (!previous || !shouldMergeIntoPrevious(previous, cell)) {
      merged.push({ ...cell, endSourceOrder: cell.sourceOrder });
      continue;
    }

    const previousProvides = new Set(previous.provides);
    previous.code = `${previous.code}\n${cell.code}`;
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

  return merged.map((cell) => ({
    id: cell.id,
    fileId: cell.fileId,
    sourceOrder: cell.sourceOrder,
    kind: cell.kind,
    code: cell.code,
    provides: cell.provides,
    internalDeps: cell.internalDeps,
    externalDeps: cell.externalDeps,
    providerDeps: cell.providerDeps,
    eager: cell.eager,
  }));
}

function shouldMergeIntoPrevious(
  previous: CellRecord & { endSourceOrder: number },
  current: CellRecord,
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
    if (entry.kind !== "value" || entry.condition) {
      continue;
    }
    const resolved = resolveImportForHash(input, entry.request ?? entry.source);
    const depPrefix = filePrefix(
      resolved.pkg.name,
      resolved.pkg.version,
      resolved.relPath,
    );

    if (entry.isNamespace) {
      if (entry.namespaceUsage === "dynamic") {
        externalSymbols.set(`__NS__${depPrefix}`, {
          kind: "import",
          source: entry.source,
          request: entry.request,
          imported: "*",
        });
        continue;
      }

      for (const spec of entry.specifiers) {
        externalSymbols.set(`${depPrefix}_${spec.imported}`, {
          kind: "import",
          source: entry.source,
          request: entry.request,
          imported: spec.imported,
        });
      }
      continue;
    }

    for (const spec of entry.specifiers) {
      const importName = spec.imported === "default" ? "default" : spec.imported;
      externalSymbols.set(`${depPrefix}_${importName}`, {
        kind: "import",
        source: entry.source,
        request: entry.request,
        imported: importName,
      });
    }
  }

  for (const entry of imports) {
    if (entry.kind === "side-effect" && !entry.condition) {
      externalSymbols.set(`${prefix}#side-effect:${entry.source}`, {
        kind: "side-effect",
        source: entry.source,
        request: entry.request,
      });
    }
  }

  return externalSymbols;
}

function collectStatementDeps(
  statementPath: NodePath<t.Statement>,
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

function collectDeclaredTopLevelSymbols(statement: t.Statement): string[] {
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
  statement: t.Statement,
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
  ast: t.File,
  traverse: typeof import("@babel/traverse").default,
): void {
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      path.remove();
    },
  });
}

function resolveImportForHash(
  input: TransformInput,
  source: string,
): { pkg: TransformInput["pkg"]; relPath: string } {
  if (source.startsWith(".")) {
    const resolvedPath =
      resolveImportPath(input.realPath, source) ??
      path.resolve(path.dirname(input.realPath), source);
    const relPath = path.posix.relative(
      input.pkg.root,
      normalizePosixPath(resolvedPath),
    );
    return { pkg: input.pkg, relPath };
  }
  const resolvedPath = resolveImportPath(input.realPath, source);
  if (!resolvedPath) {
    return { pkg: input.pkg, relPath: source };
  }
  const pkgRoot = findPkgRoot(resolvedPath) ?? path.dirname(resolvedPath);
  const pkg = readPkgSafe(pkgRoot);
  const relPath = path.posix.relative(
    pkg.root,
    normalizePosixPath(resolvedPath),
  );
  return { pkg, relPath };
}

function resolveImportPath(fromPath: string, source: string): string | null {
  if (source.startsWith(".")) {
    const base = path.resolve(path.dirname(fromPath), source);
    return resolveWithExtensions(base) ?? base;
  }
  try {
    return require.resolve(source, { paths: [path.dirname(fromPath)] });
  } catch {
    return null;
  }
}

function resolveWithExtensions(filePath: string): string | null {
  const extensions = [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs"];
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  for (const ext of extensions) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const indexPath = path.join(filePath, "index.js");
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }
  return null;
}

function isImportMetaUrl(node: t.MemberExpression): boolean {
  return (
    t.isMetaProperty(node.object) &&
    node.object.meta.name === "import" &&
    node.object.property.name === "meta" &&
    t.isIdentifier(node.property, { name: "url" })
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
      t.isIdentifier(attr.key) &&
      t.isStringLiteral(attr.value)
    ) {
      acc[attr.key.name] = attr.value.value;
    }
    return acc;
  }, {});
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

function emitConditionalStart(condition: ConditionalImport["condition"]): string {
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

function renameModuleBinding(binding: Binding, newName: string): void {
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
    refPath.node.name = newName;
  }
  for (const path of binding.constantViolations) {
    if (path.isIdentifier()) {
      path.node.name = newName;
    } else if (path.isAssignmentExpression()) {
      const left = path.get("left");
      if (left.isIdentifier()) {
        left.node.name = newName;
      }
    }
  }
}
