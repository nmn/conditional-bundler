import path from "node:path";
import { createRequire } from "node:module";
import {
  contentHash,
  contentHashShort,
  findPkgRoot,
  normalizePosixPath,
  readPkgSafe,
} from "@bundler/shared";
import stylexBabelPlugin from "@stylexjs/babel-plugin";

const requireFromPlugin = createRequire(import.meta.url);
const stylexPackage = readPkgSafe(
  findPkgRoot(requireFromPlugin.resolve("@stylexjs/babel-plugin")) ??
    process.cwd(),
);

export default function stylexBundlerPlugin(options = {}) {
  const stylexOptions = {
    dev: options.dev === true,
    runtimeInjection: false,
    treeshakeCompensation: true,
    __bundlerExcludeNodeModules: true,
    ...(options.rootDir
      ? {
          unstable_moduleResolution: {
            type: "commonJS",
            rootDir: options.rootDir,
          },
        }
      : {}),
  };

  return {
    name: options.name ?? "stylex-plugin",
    resourceFingerprint: `stylex-plugin-v2:@stylexjs/babel-plugin@${stylexPackage.version}`,
    transform: [
      ["@stylexjs/babel-plugin", stylexOptions],
      [
        "./capture-metadata.mjs",
        {
          __bundlerExcludeNodeModules: true,
        },
      ],
    ],
    planBundleResources(context) {
      const rules = collectStylexRules(context.modules);
      const fingerprint =
        rules.length === 0 ? "none" : contentHash(JSON.stringify(rules));
      return Object.fromEntries(
        context.bundles.map((bundle) => [bundle.id, fingerprint]),
      );
    },
    async generateBundleResources(context) {
      const rules = collectStylexRules(context.modules);
      if (rules.length === 0) {
        return;
      }
      const unannotatedCss = stylexBabelPlugin.processStylexRules(
        rules,
        options.processOptions,
      );
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
          .replaceAll("[entry]", options.entryName ?? "stylex")
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
      const bundleKey = options.bundleKey ?? "stylex:global";
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
            sources: [],
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

function collectStylexRules(modules) {
  return dedupeRules(
    modules.flatMap((moduleRecord) =>
      Object.values(moduleRecord.extraOutputs ?? {}).flatMap((output) =>
        output.type === "stylex-json" && Array.isArray(output.metadata?.rules)
          ? output.metadata.rules
          : [],
      ),
    ),
  );
}

function outputAxisToken(values, override) {
  if (override) return override;
  const unique = Array.from(new Set(values)).sort();
  return unique.length === 1 ? unique[0] : "all";
}

function dedupeRules(rules) {
  return Array.from(
    new Map(rules.map((rule) => [JSON.stringify(rule), rule])).values(),
  );
}

function resolveSourceMapMode(sourceMap) {
  if (!sourceMap) return false;
  if (typeof sourceMap === "string") return sourceMap;
  return sourceMap.mode;
}
