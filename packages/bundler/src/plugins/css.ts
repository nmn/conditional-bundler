import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { transform as transformCss } from "lightningcss";
import { findPkgRoot, packagePathIdentity, readPkgSafe } from "@bundler/shared";
import type {
  BundlerPlugin,
  LoadContext,
  ResolveImportContext,
} from "./types.js";

const CSS_ID_PREFIX = "bundler-css:";
const requireFromCwd = createRequire(`${process.cwd()}/package.json`);

export function createCssPlugin(): BundlerPlugin {
  return {
    name: "builtin-css",
    async resolveImport(context: ResolveImportContext) {
      "builtin-css-resolve-v1";
      if (!isCssRequest(context.request)) {
        return undefined;
      }
      const filePath = await resolveCssPath(
        context.fromFilePath,
        context.request,
      );
      return {
        id: toCssId(filePath),
        filePath,
        moduleIdentity: packagePathIdentity(
          readPkgSafe(findPkgRoot(filePath) ?? path.dirname(filePath)),
          filePath,
        ),
      };
    },
    async load(context: LoadContext) {
      "builtin-css-load-v1";
      if (!context.id.startsWith(CSS_ID_PREFIX)) {
        return undefined;
      }
      const filePath = fromCssId(context.id);
      const source = await fs.readFile(filePath, "utf8");
      const isModule = isCssModule(filePath);
      const result = transformCss({
        filename: filePath,
        code: Buffer.from(source),
        cssModules: isModule,
        sourceMap: true,
      });
      const classes = Object.fromEntries(
        Object.entries(result.exports ?? {}).map(([name, value]) => [
          name,
          value.name,
        ]),
      );
      const css = Buffer.from(result.code).toString("utf8");
      const map = result.map
        ? Buffer.from(result.map).toString("utf8")
        : undefined;
      return {
        code: isModule ? emitCssModuleJs(classes) : "void 0;",
        extraOutputs: {
          "bundler-css": {
            contents: css,
            map,
            metadata: {
              filePath,
              module: isModule,
              classes,
            },
          },
        },
      };
    },
    buildEnd({ manifest, modules, emitFile }) {
      const moduleOutputs = new Map(
        modules.flatMap((moduleRecord) => {
          const cssOutput = moduleRecord.extraOutputs?.["bundler-css"];
          if (!cssOutput) {
            return [];
          }
          return [
            [`${moduleRecord.envs[0]}:${moduleRecord.id}`, cssOutput.contents],
          ];
        }),
      );

      for (const bundle of manifest.bundles) {
        const cssParts = bundle.modules
          .map((moduleId) => moduleOutputs.get(`${bundle.envId}:${moduleId}`))
          .filter((value): value is string => Boolean(value));
        if (cssParts.length === 0) {
          continue;
        }
        emitFile({
          fileName: `${sanitizeBundleName(bundle.entryId)}.${bundle.envId}.css`,
          contents: cssParts.join("\n"),
          envId: bundle.envId,
          hash: true,
          type: "style",
          contentType: "text/css; charset=utf-8",
          bundleKey: `${bundle.envId}:${bundle.entryId}`,
        });
      }
    },
  };
}

function isCssRequest(request: string): boolean {
  return request.endsWith(".css");
}

function isCssModule(filePath: string): boolean {
  return filePath.endsWith(".module.css");
}

function toCssId(filePath: string): string {
  return `${CSS_ID_PREFIX}${path.resolve(filePath)}`;
}

function fromCssId(id: string): string {
  return id.slice(CSS_ID_PREFIX.length);
}

async function resolveCssPath(
  fromFilePath: string,
  request: string,
): Promise<string> {
  if (request.startsWith(".") || request.startsWith("/")) {
    const candidate = request.startsWith("/")
      ? request
      : path.resolve(path.dirname(fromFilePath), request);
    await fs.access(candidate);
    return candidate;
  }
  return requireFromCwd.resolve(request, {
    paths: [path.dirname(fromFilePath)],
  });
}

function emitCssModuleJs(classes: Record<string, string>): string {
  const lines = [
    `const classes = ${JSON.stringify(classes)};`,
    "export default classes;",
  ];
  for (const name of Object.keys(classes).sort()) {
    if (!isValidExportName(name)) {
      continue;
    }
    lines.push(`export const ${name} = classes[${JSON.stringify(name)}];`);
  }
  lines.push("void 0;");
  return lines.join("\n");
}

function isValidExportName(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !reservedWords.has(name);
}

function sanitizeBundleName(value: string): string {
  return path
    .basename(value)
    .replace(/\.[cm]?[jt]sx?$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const reservedWords = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "enum",
  "await",
]);
