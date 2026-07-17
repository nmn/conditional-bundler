import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  contentHashShort,
  normalizePosixPath,
  readPkgSafe,
  findPkgRoot,
} from "@bundler/shared";

const requireFromPlugin = createRequire(import.meta.url);
const lightningCssPackage = readPkgSafe(
  findPkgRoot(requireFromPlugin.resolve("lightningcss")) ?? process.cwd(),
);

export default function cssBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "css-plugin",
    resourceFingerprint: `css-plugin-v3:lightningcss@${lightningCssPackage.version}`,
    async generateBundleResources(context) {
      const moduleOutputs = new Map();
      for (const moduleRecord of context.modules) {
        const output = moduleRecord.extraOutputs?.["bundler-css"];
        if (output) {
          const item = {
            moduleId: moduleRecord.moduleIdentity ?? moduleRecord.id,
            output,
            record: moduleRecord,
          };
          for (const envId of moduleRecord.environmentIds ??
            moduleRecord.envs ??
            []) {
            moduleOutputs.set(`${envId}:${moduleRecord.id}`, item);
            moduleOutputs.set(`${envId}:${item.moduleId}`, item);
          }
        }
      }

      for (const bundle of context.bundles) {
        const selected = Array.from(
          new Map(
            bundle.environmentIds
              .flatMap((envId) =>
                bundle.modules.map((moduleId) =>
                  moduleOutputs.get(`${envId}:${moduleId}`),
                ),
              )
              .filter(Boolean)
              .map((item) => [item.moduleId, item]),
          ).values(),
        );
        if (selected.length === 0) {
          continue;
        }
        const entry = sanitizeBundleName(bundle.entryId);
        const pattern =
          context.outputs.cssFileName ?? "[entry].[env].[hash].css";
        const scope =
          bundle.environmentIds.length === 1
            ? bundle.environmentIds[0]
            : "universal";
        const provisional = normalizePosixPath(
          pattern
            .replaceAll("[entry]", entry)
            .replaceAll("[scope]", scope)
            .replaceAll("[env]", scope)
            .replaceAll("[hash]", "RESOURCE_HASH"),
        );
        const selectedById = new Map(
          selected.flatMap((item) => [
            [item.moduleId, item],
            [item.record.id, item],
          ]),
        );
        const importedIds = new Set(
          selected.flatMap((item) =>
            readCssImports(item.output)
              .map((dependency) => dependency.moduleId)
              .filter((moduleId) => selectedById.has(moduleId)),
          ),
        );
        const roots = selected.filter(
          (item) => !importedIds.has(item.moduleId),
        );
        const rendered = [];
        const emittedModules = new Set();
        for (const item of roots.length > 0 ? roots : selected) {
          rendered.push(
            ...(await renderCssModule(
              item.moduleId,
              selectedById,
              provisional,
              context.resolveReference,
              emittedModules,
            )),
          );
        }
        const cssVariableReferences = Array.from(
          new Map(
            rendered
              .flatMap((item) => item.references ?? [])
              .filter((reference) => reference.usage === "css-variable")
              .map((reference) => [reference.id, reference]),
          ).values(),
        ).sort((left, right) => left.symbol.localeCompare(right.symbol));
        if (cssVariableReferences.length > 0) {
          rendered.unshift({
            css: `:root {\n${cssVariableReferences
              .map(
                (reference) =>
                  `  ${reference.symbol}: url("${escapeCssUrl(
                    context.resolveReference(reference.id, provisional),
                  )}");`,
              )
              .join("\n")}\n}`,
            map: null,
            mapLineOffset: 0,
            references: [],
          });
        }
        const cssParts = rendered.map((item) => item.css);
        const unannotatedCss = cssParts.join("\n");
        const hash = contentHashShort(unannotatedCss);
        const fileName = provisional.replace("RESOURCE_HASH", hash);
        const sourceMapMode = resolveSourceMapMode(context.outputs.sourceMap);
        const maps = rendered.map((item) => item.map);
        const mapLineOffsets = rendered.map((item) => item.mapLineOffset ?? 0);
        const mapFileName = sourceMapMode ? `${fileName}.map` : undefined;
        const css =
          sourceMapMode === "external" && mapFileName
            ? `${unannotatedCss}\n/*# sourceMappingURL=${path.basename(mapFileName)} */`
            : unannotatedCss;
        context.emitFile({
          fileName,
          contents: css,
          envId: bundle.environmentIds.length === 1 ? bundle.envId : undefined,
          type: "style",
          contentType: "text/css; charset=utf-8",
          bundleKey: bundle.id,
        });
        if (mapFileName) {
          context.emitFile({
            fileName: mapFileName,
            contents: JSON.stringify(
              createIndexedMap(maps, cssParts, fileName, mapLineOffsets),
            ),
            envId:
              bundle.environmentIds.length === 1 ? bundle.envId : undefined,
            type: "source-map",
            contentType: "application/json; charset=utf-8",
            bundleKey: bundle.id,
          });
        }
      }
    },
  };
}

async function serializeTemplate(output, fileName, resolveReference) {
  const template = output.template;
  if (!template) {
    return readOutputContents(output);
  }
  return template.parts
    .map((part) => {
      if (part.kind === "text") {
        return part.value;
      }
      return escapeCssUrl(resolveReference(part.referenceId, fileName));
    })
    .join("");
}

async function renderCssModule(
  moduleId,
  selectedById,
  fileName,
  resolveReference,
  emitted,
) {
  if (emitted.has(moduleId)) return [];
  emitted.add(moduleId);
  const item = selectedById.get(moduleId);
  if (!item) return [];
  const output = item.output;
  if (Array.isArray(output.metadata?.cells)) {
    return renderCssCellGraph(
      item,
      output.metadata.rootCellId,
      selectedById,
      fileName,
      resolveReference,
      emitted,
      new Set(),
      new Set(),
    );
  }
  const rendered = [];
  for (const dependency of readCssImports(output)) {
    if (!dependency.moduleId || !selectedById.has(dependency.moduleId)) {
      continue;
    }
    const child = await renderCssModule(
      dependency.moduleId,
      selectedById,
      fileName,
      resolveReference,
      emitted,
    );
    for (const item of child) {
      const wrapped = wrapImportedCss(item.css, dependency);
      rendered.push({
        ...item,
        css: wrapped.css,
        mapLineOffset: (item.mapLineOffset ?? 0) + wrapped.mapLineOffset,
      });
    }
  }
  rendered.push({
    css: await serializeTemplate(output, fileName, resolveReference),
    map: await readOutputMap(output),
    mapLineOffset: 0,
    references: output.template?.references ?? [],
  });
  return rendered;
}

async function renderCssCellGraph(
  item,
  cellId,
  selectedById,
  fileName,
  resolveReference,
  emittedModules,
  emittedCells,
  visitingCells,
) {
  if (!cellId || emittedCells.has(cellId)) return [];
  if (visitingCells.has(cellId)) {
    throw new Error(`Cyclic CSS cell dependency '${cellId}'.`);
  }
  const cell = item.output.metadata.cells.find(
    (candidate) => candidate.cellId === cellId,
  );
  if (!cell) {
    throw new Error(`Missing CSS cell '${cellId}' in '${item.moduleId}'.`);
  }
  visitingCells.add(cellId);
  const rendered = [];
  for (const dependency of cell.orderedDeps ?? []) {
    if (dependency.kind === "cell") {
      rendered.push(
        ...(await renderCssCellGraph(
          item,
          dependency.cellId,
          selectedById,
          fileName,
          resolveReference,
          emittedModules,
          emittedCells,
          visitingCells,
        )),
      );
      continue;
    }
    if (dependency.kind === "runtime-import") {
      rendered.push({
        css: dependency.rule,
        map: null,
        mapLineOffset: 0,
        references: [],
      });
      continue;
    }
    if (dependency.kind !== "import") continue;
    const childItem = selectedById.get(dependency.moduleId);
    if (!childItem || emittedModules.has(dependency.moduleId)) continue;
    const child = await renderCssModule(
      dependency.moduleId,
      selectedById,
      fileName,
      resolveReference,
      emittedModules,
    );
    for (const childPart of child) {
      const wrapped = wrapImportedCss(childPart.css, dependency);
      rendered.push({
        ...childPart,
        css: wrapped.css,
        mapLineOffset: (childPart.mapLineOffset ?? 0) + wrapped.mapLineOffset,
      });
    }
  }
  visitingCells.delete(cellId);
  emittedCells.add(cellId);
  const cellOutput = item.record.extraOutputs?.[cell.outputName];
  if (!cellOutput) {
    throw new Error(`Missing CSS artifact '${cell.outputName}'.`);
  }
  rendered.push({
    css: await serializeTemplate(cellOutput, fileName, resolveReference),
    map: await readOutputMap(cellOutput),
    mapLineOffset: 0,
    references: cellOutput.template?.references ?? [],
  });
  return rendered;
}

function readCssImports(output) {
  const metadata = output.metadata;
  if (Array.isArray(metadata?.cells)) {
    return metadata.cells.flatMap((cell) =>
      (cell.orderedDeps ?? []).filter(
        (dependency) => dependency.kind === "import",
      ),
    );
  }
  return Array.isArray(metadata?.imports) ? metadata.imports : [];
}

function wrapImportedCss(css, dependency) {
  let output = css;
  let mapLineOffset = 0;
  if (dependency.media) {
    output = `@media ${dependency.media} {\n${output}\n}`;
    mapLineOffset += 1;
  }
  if (dependency.supports) {
    output = `@supports ${dependency.supports} {\n${output}\n}`;
    mapLineOffset += 1;
  }
  if (dependency.layer !== null && dependency.layer !== undefined) {
    output = dependency.layer
      ? `@layer ${dependency.layer} {\n${output}\n}`
      : `@layer {\n${output}\n}`;
    mapLineOffset += 1;
  }
  return { css: output, mapLineOffset };
}

async function readOutputContents(output) {
  if (typeof output.contents === "string") return output.contents;
  if (output.contents) return Buffer.from(output.contents).toString("utf8");
  if (output.artifactPath) return fs.readFile(output.artifactPath, "utf8");
  return "";
}

async function readOutputMap(output) {
  if (output.map) return JSON.parse(output.map);
  if (output.mapArtifactPath) {
    return JSON.parse(await fs.readFile(output.mapArtifactPath, "utf8"));
  }
  return null;
}

function createIndexedMap(maps, cssParts, fileName, mapLineOffsets = []) {
  const sections = [];
  let line = 0;
  for (let index = 0; index < cssParts.length; index += 1) {
    if (maps[index]) {
      sections.push({
        offset: { line: line + (mapLineOffsets[index] ?? 0), column: 0 },
        map: maps[index],
      });
    }
    line += countLines(cssParts[index]) + (index + 1 < cssParts.length ? 1 : 0);
  }
  return { version: 3, file: fileName, sections };
}

function countLines(value) {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

function resolveSourceMapMode(value) {
  if (!value) return false;
  return typeof value === "string" ? value : value.mode;
}

function escapeCssUrl(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function sanitizeBundleName(value) {
  return path
    .basename(value)
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
