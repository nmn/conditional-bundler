// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { parse, type ParserPlugin } from "@babel/parser";
import traverseModule, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { ResolveImportKind } from "./types.js";

export type ScannedImportRequest = {
  key: string;
  kind: ResolveImportKind;
  request: string;
  importAttributes?: Record<string, string>;
};

export function toImportResolutionKey(
  kind: ResolveImportKind,
  request: string,
): string {
  return `${kind}:${request}`;
}

export function scanModuleRequests(input: {
  code: string;
  filePath: string;
  syntax: { jsx: boolean; ts: boolean };
}): ScannedImportRequest[] {
  const ast = parse(input.code, {
    sourceType: "module",
    sourceFilename: input.filePath,
    plugins: getParserPlugins(input.syntax),
  });
  const requests = new Map<string, ScannedImportRequest>();
  const traverse = ((
    traverseModule as unknown as {
      default?: typeof import("@babel/traverse").default;
    }
  ).default ??
    (traverseModule as unknown as typeof import("@babel/traverse").default)) as typeof import("@babel/traverse").default;

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const request = path.node.source.value;
      const attributes = readImportAttributes(path.node);
      const kind = attributes.condition ? "conditional-import" : "import";
      requests.set(toImportResolutionKey(kind, request), {
        key: toImportResolutionKey(kind, request),
        kind,
        request,
        importAttributes:
          Object.keys(attributes).length > 0 ? attributes : undefined,
      });
      if (attributes.else) {
        requests.set(
          toImportResolutionKey("conditional-else", attributes.else),
          {
            key: toImportResolutionKey("conditional-else", attributes.else),
            kind: "conditional-else",
            request: attributes.else,
          },
        );
      }
    },
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (!path.node.source) {
        return;
      }
      const request = path.node.source.value;
      requests.set(toImportResolutionKey("reexport", request), {
        key: toImportResolutionKey("reexport", request),
        kind: "reexport",
        request,
      });
    },
    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      const request = path.node.source.value;
      requests.set(toImportResolutionKey("reexport", request), {
        key: toImportResolutionKey("reexport", request),
        kind: "reexport",
        request,
      });
    },
    Import(path: NodePath<t.Import>) {
      const parentPath = path.parentPath;
      const parent = parentPath.node;
      if (
        t.isCallExpression(parent) &&
        parent.arguments.length === 1 &&
        t.isStringLiteral(parent.arguments[0])
      ) {
        const request = parent.arguments[0].value;
        requests.set(toImportResolutionKey("dynamic-import", request), {
          key: toImportResolutionKey("dynamic-import", request),
          kind: "dynamic-import",
          request,
        });
      }
    },
  });

  return Array.from(requests.values());
}

function getParserPlugins(syntax: {
  jsx: boolean;
  ts: boolean;
}): ParserPlugin[] {
  const plugins: ParserPlugin[] = ["importAttributes"];
  if (syntax.ts) {
    plugins.push("typescript");
  }
  if (syntax.jsx) {
    plugins.push("jsx");
  }
  return plugins;
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
