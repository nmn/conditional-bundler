import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  contentHashShort,
  findPkgRoot,
  normalizePosixPath,
  readPkgSafe,
} from "@bundler/shared";
import { compile } from "tailwindcss";

const requireFromPlugin = createRequire(import.meta.url);
const tailwindPackageRoot =
  findPkgRoot(requireFromPlugin.resolve("tailwindcss")) ?? process.cwd();
const tailwindPackage = readPkgSafe(tailwindPackageRoot);

export default function tailwindBundlerPlugin(options = {}) {
  const cssFiles = normalizeCssFiles(options.cssFiles ?? options.cssFile);
  return {
    name: options.name ?? "tailwind-plugin",
    resourceFingerprint: `tailwind-plugin-v1:tailwindcss@${tailwindPackage.version}`,
    transform: [
      [
        "./extract-candidates.mjs",
        {
          __bundlerExcludeNodeModules: true,
        },
      ],
    ],
    async generateBundleResources(context) {
      const inputCss = await readInputCss(cssFiles);
      const compiler = await compile(inputCss, {
        base: options.rootDir ?? process.cwd(),
        loadStylesheet: loadTailwindStylesheet,
      });
      const candidates = Array.from(
        new Set(
          context.modules.flatMap((moduleRecord) =>
            Object.values(moduleRecord.extraOutputs ?? {}).flatMap((extra) =>
              extra.type === "tailwind-candidates" &&
              Array.isArray(extra.metadata?.candidates)
                ? extra.metadata.candidates
                : [],
            ),
          ),
        ),
      ).sort();
      const unannotatedCss = compiler.build(candidates);
      if (!unannotatedCss.trim()) {
        return;
      }
      const owner = context.bundles[0];
      const pattern = context.outputs.cssFileName ?? "[entry].[env].[hash].css";
      const fileName = normalizePosixPath(
        pattern
          .replaceAll("[entry]", options.entryName ?? "tailwind")
          .replaceAll("[env]", options.envName ?? "all")
          .replaceAll("[hash]", contentHashShort(unannotatedCss)),
      );
      const sourceMapMode = resolveSourceMapMode(context.outputs.sourceMap);
      const mapFileName = sourceMapMode ? `${fileName}.map` : undefined;
      const css =
        sourceMapMode === "external" && mapFileName
          ? `${unannotatedCss}\n/*# sourceMappingURL=${path.basename(mapFileName)} */`
          : unannotatedCss;
      const bundleKey = owner?.id;
      context.emitFile({
        fileName,
        contents: css,
        envId: owner?.envId,
        type: "style",
        contentType: "text/css; charset=utf-8",
        bundleKey,
        global: true,
      });
      if (mapFileName) {
        context.emitFile({
          fileName: mapFileName,
          contents: JSON.stringify({
            version: 3,
            file: path.basename(fileName),
            sources: cssFiles.map(
              (filePath) =>
                `bundler:///${normalizePosixPath(path.basename(filePath))}`,
            ),
            names: [],
            mappings: "",
          }),
          envId: owner?.envId,
          type: "source-map",
          contentType: "application/json; charset=utf-8",
          bundleKey,
        });
      }
    },
  };
}

function normalizeCssFiles(value) {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

async function readInputCss(cssFiles) {
  if (cssFiles.length === 0) {
    return '@import "tailwindcss";';
  }
  return (
    '@import "tailwindcss";\n' +
    (
      await Promise.all(
        cssFiles.map((filePath) => fs.readFile(filePath, "utf8")),
      )
    ).join("\n")
  );
}

async function loadTailwindStylesheet(id, base) {
  const filePath =
    id === "tailwindcss"
      ? path.join(tailwindPackageRoot, "index.css")
      : path.resolve(base, id);
  return {
    base: path.dirname(filePath),
    content: await fs.readFile(filePath, "utf8"),
  };
}

function resolveSourceMapMode(sourceMap) {
  if (!sourceMap) return false;
  if (typeof sourceMap === "string") return sourceMap;
  return sourceMap.mode;
}
