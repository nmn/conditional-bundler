import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  contentHash,
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
    async planBundleResources(context) {
      const inputCss = await readInputCss(cssFiles);
      const candidates = collectTailwindCandidates(context.modules);
      const fingerprint = contentHash(JSON.stringify({ inputCss, candidates }));
      return Object.fromEntries(
        context.bundles.map((bundle) => [bundle.id, fingerprint]),
      );
    },
    async generateBundleResources(context) {
      const inputCss = await readInputCss(cssFiles);
      const compiler = await compile(inputCss, {
        base: options.rootDir ?? process.cwd(),
        loadStylesheet: loadTailwindStylesheet,
      });
      const candidates = collectTailwindCandidates(context.modules);
      const unannotatedCss = compiler.build(candidates);
      if (!unannotatedCss.trim()) {
        return;
      }
      const pattern =
        context.outputs.cssFileName ??
        "[entry].[target].[environment].[hash].css";
      const environment = outputAxisToken(
        context.bundles.flatMap((bundle) => bundle.environmentIds),
        options.environmentName,
      );
      const target = outputAxisToken(
        context.bundles.flatMap((bundle) => bundle.targetIds),
        options.targetName,
      );
      const fileName = normalizePosixPath(
        pattern
          .replaceAll("[entry]", options.entryName ?? "tailwind")
          .replaceAll("[environment]", environment)
          .replaceAll("[target]", target)
          .replaceAll("[hash]", contentHashShort(unannotatedCss)),
      );
      const sourceMapMode = resolveSourceMapMode(context.outputs.sourceMap);
      const mapFileName = sourceMapMode ? `${fileName}.map` : undefined;
      const css =
        sourceMapMode === "external" && mapFileName
          ? `${unannotatedCss}\n/*# sourceMappingURL=${path.basename(mapFileName)} */`
          : unannotatedCss;
      const bundleKey = options.bundleKey ?? "tailwind:global";
      context.emitFile({
        fileName,
        contents: css,
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
          type: "source-map",
          contentType: "application/json; charset=utf-8",
          bundleKey,
        });
      }
    },
  };
}

function collectTailwindCandidates(modules) {
  return Array.from(
    new Set(
      modules.flatMap((moduleRecord) =>
        Object.values(moduleRecord.extraOutputs ?? {}).flatMap((extra) =>
          extra.type === "tailwind-candidates" &&
          Array.isArray(extra.metadata?.candidates)
            ? extra.metadata.candidates
            : [],
        ),
      ),
    ),
  ).sort();
}

function outputAxisToken(values, override) {
  if (override) return override;
  const unique = Array.from(new Set(values)).sort();
  return unique.length === 1 ? unique[0] : "all";
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
