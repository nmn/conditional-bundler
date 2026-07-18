import {
  transform as lightningTransform,
  type ImportDependency,
  type UrlDependency,
} from "lightningcss";
import {
  contentHashShort,
  portableSourceName,
  type ExtraTransformOutput,
  type LinkReference,
  type TransformResolvedImport,
  type TransformResult,
} from "@bundler/shared";
import { prepareCoreTransform, transformWithCore } from "./core.js";

export type CssDependencyRequest = {
  key: string;
  kind: "css-import" | "css-url";
  request: string;
  importAttributes?: Record<string, string>;
};

type CssImport = {
  request: string;
  raw: string;
  media: string | null;
  supports: string | null;
  layer: string | null;
};

type CssUrlDependency = {
  request: string;
  placeholder: string;
};

type CssModuleExportInfo = {
  name: string;
  composes: Array<
    | { type: "local" | "global"; name: string }
    | { type: "dependency"; name: string; specifier: string }
  >;
};

type AnalyzedSegment = {
  sourceOrder: number;
  css: string;
  map?: string;
  urls: CssUrlDependency[];
  exports: Record<string, CssModuleExportInfo>;
};

type SequenceItem =
  | { kind: "segment"; segment: AnalyzedSegment }
  | { kind: "import"; dependency: CssImport; local: boolean };

export type CssAnalysis = {
  isModule: boolean;
  requests: CssDependencyRequest[];
  sequence: SequenceItem[];
  classes: Record<string, string>;
  exports: Record<string, CssModuleExportInfo>;
};

export type CssTransformInput = {
  id: string;
  moduleIdentity: string;
  canonicalPath: string;
  realPath: string;
  code: string;
  pkg: { name: string; version: string; root: string };
  envs: string[];
  envId: string;
  target: "node" | "browser";
  buildMode: string;
  sourceMap?: {
    sourceFileName: string;
    sourcesContent: boolean;
  };
  dev?: { hmr?: boolean };
};

export function analyzeCss(input: CssTransformInput): CssAnalysis {
  const isModule = input.realPath.toLowerCase().endsWith(".module.css");
  const chunks = splitTopLevelImports(input.code);
  const sequence: SequenceItem[] = [];
  const classes: Record<string, string> = {};
  const exportsInfo: Record<string, CssModuleExportInfo> = {};
  const requests: CssDependencyRequest[] = [];
  let sourceOrder = 0;

  for (const chunk of chunks) {
    if (chunk.kind === "import") {
      const dependency = parseImportRule(chunk.value, input.canonicalPath);
      const local = isLocalCssRequest(dependency.request);
      sequence.push({ kind: "import", dependency, local });
      if (local) {
        requests.push({
          key: `css-import:${dependency.request}`,
          kind: "css-import",
          request: dependency.request,
        });
      }
      continue;
    }

    if (chunk.value.length === 0) continue;
    const desiredByOriginal = new Map<string, string>();
    const originalByDesired = new Map<string, string>();
    const result = lightningTransform({
      filename:
        input.sourceMap?.sourceFileName ??
        portableSourceName(input.canonicalPath),
      code: Buffer.from(chunk.value),
      minify: false,
      sourceMap: Boolean(input.sourceMap),
      analyzeDependencies: true,
      cssModules: isModule ? { pattern: "[local]" } : false,
      visitor: isModule
        ? {
            Selector(selector) {
              renameSelectorClasses(
                selector as unknown[],
                input.canonicalPath,
                input.buildMode,
                desiredByOriginal,
                originalByDesired,
                true,
              );
              return selector;
            },
          }
        : undefined,
    });

    const segmentExports: Record<string, CssModuleExportInfo> = {};
    for (const [desiredKey, value] of Object.entries(result.exports ?? {})) {
      const original = originalByDesired.get(desiredKey) ?? desiredKey;
      const desired = desiredByOriginal.get(original) ?? value.name;
      classes[original] = desired;
      const normalized: CssModuleExportInfo = {
        name: desired,
        composes: (value.composes ?? []) as CssModuleExportInfo["composes"],
      };
      segmentExports[original] = normalized;
      exportsInfo[original] = normalized;
    }

    const urls = (result.dependencies ?? [])
      .filter(
        (dependency): dependency is UrlDependency =>
          dependency.type === "url" && isLocalCssRequest(dependency.url),
      )
      .map((dependency) => ({
        request: dependency.url,
        placeholder: dependency.placeholder,
      }));
    for (const dependency of urls) {
      requests.push({
        key: `css-url:${dependency.request}`,
        kind: "css-url",
        request: dependency.request,
        importAttributes: { as: "url" },
      });
    }

    sequence.push({
      kind: "segment",
      segment: {
        sourceOrder,
        css: Buffer.from(result.code).toString("utf8"),
        map: result.map
          ? normalizeCssMap(
              Buffer.from(result.map).toString("utf8"),
              input.sourceMap?.sourcesContent === true,
            )
          : undefined,
        urls,
        exports: segmentExports,
      },
    });
    sourceOrder += 1;
  }

  for (const value of Object.values(exportsInfo)) {
    for (const composition of value.composes) {
      if (composition.type !== "dependency") continue;
      requests.push({
        key: `css-import:${composition.specifier}`,
        kind: "css-import",
        request: composition.specifier,
      });
    }
  }

  return {
    isModule,
    requests: dedupeRequests(requests),
    sequence,
    classes,
    exports: exportsInfo,
  };
}

export function finalizeCssTransform(
  input: CssTransformInput,
  analysis: CssAnalysis,
  resolved: Record<string, TransformResolvedImport>,
): TransformResult {
  const extraOutputs: Record<string, ExtraTransformOutput> = {};
  const cellMetadata: Array<Record<string, unknown>> = [];
  const allReferences: LinkReference[] = [];
  const facadeImports: string[] = [];
  const seenFacadeImports = new Set<string>();
  let previousCellId: string | undefined;
  let pendingDependencies: Array<Record<string, unknown>> = [];
  let cellIndex = 0;

  const pushFacadeImport = (code: string) => {
    if (seenFacadeImports.has(code)) return;
    seenFacadeImports.add(code);
    facadeImports.push(code);
  };

  for (const item of analysis.sequence) {
    if (item.kind === "import") {
      if (!item.local) {
        pendingDependencies.push({
          kind: "runtime-import",
          rule: item.dependency.raw,
        });
        continue;
      }
      const resolution = requireFileResolution(
        resolved[`css-import:${item.dependency.request}`],
        item.dependency.request,
        input.canonicalPath,
      );
      pendingDependencies.push({
        kind: "import",
        request: item.dependency.request,
        moduleId: resolution.target.moduleId,
        media: item.dependency.media,
        supports: item.dependency.supports,
        layer: item.dependency.layer,
      });
      pushFacadeImport(`import ${JSON.stringify(item.dependency.request)};`);
      continue;
    }

    const outputName = `bundler-css-cell:${String(cellIndex).padStart(3, "0")}`;
    const cellId = `${input.moduleIdentity}::css:${cellIndex}`;
    const references: LinkReference[] = [];
    let css = item.segment.css;
    for (const dependency of item.segment.urls) {
      const resolution = requireFileResolution(
        resolved[`css-url:${dependency.request}`],
        dependency.request,
        input.canonicalPath,
      );
      const assetId = readAssetId(resolution, dependency.request);
      const cssVariable = `--${contentHashShort(assetId)}__finalURL`;
      css = replaceCssUrlPlaceholder(
        css,
        dependency.placeholder,
        `var(${cssVariable})`,
      );
      const reference: LinkReference = {
        id: `${input.moduleIdentity}::css-asset:${assetId}`,
        kind: "output-url",
        symbol: cssVariable,
        outputId: assetId,
        outputType: "asset",
        ownerId: input.moduleIdentity,
        usage: "css-variable",
      };
      references.push(reference);
      allReferences.push(reference);
      pushFacadeImport(
        `import ${JSON.stringify(dependency.request)} with { as: "url" };`,
      );
    }

    const orderedDeps = [
      ...(previousCellId ? [{ kind: "cell", cellId: previousCellId }] : []),
      ...pendingDependencies,
    ];
    extraOutputs[outputName] = {
      contents: css,
      map: item.segment.map,
      template: {
        parts: [{ kind: "text", value: css }],
        references,
      },
      metadata: { cellId, sourceOrder: item.segment.sourceOrder, orderedDeps },
    };
    cellMetadata.push({ cellId, outputName, orderedDeps });
    previousCellId = cellId;
    pendingDependencies = [];
    cellIndex += 1;
  }

  if (!previousCellId || pendingDependencies.length > 0) {
    const outputName = `bundler-css-cell:${String(cellIndex).padStart(3, "0")}`;
    const cellId = `${input.moduleIdentity}::css:${cellIndex}`;
    const orderedDeps = [
      ...(previousCellId ? [{ kind: "cell", cellId: previousCellId }] : []),
      ...pendingDependencies,
    ];
    extraOutputs[outputName] = {
      contents: "",
      metadata: { cellId, sourceOrder: cellIndex, orderedDeps },
    };
    cellMetadata.push({ cellId, outputName, orderedDeps });
    previousCellId = cellId;
  }

  for (const value of Object.values(analysis.exports)) {
    for (const [index, composition] of value.composes.entries()) {
      if (composition.type !== "dependency") continue;
      const local = `__bundler_css_compose_${safeIdentifier(value.name)}_${index}`;
      pushFacadeImport(
        `import { ${safeIdentifier(composition.name)} as ${local} } from ${JSON.stringify(composition.specifier)};`,
      );
    }
  }

  const facade = emitCssFacade(analysis, facadeImports);
  const prepared = prepareCoreTransform(
    {
      code: facade,
      realPath: input.realPath,
      syntax: { jsx: false, ts: false },
    },
    input.sourceMap?.sourceFileName,
  );
  const coreResolved = mapFacadeResolutions(prepared.importRequests, resolved);
  const coreResult = transformWithCore(
    {
      id: input.id,
      moduleIdentity: input.moduleIdentity,
      canonicalPath: input.canonicalPath,
      code: facade,
      realPath: input.realPath,
      pkg: input.pkg,
      syntax: { jsx: false, ts: false },
      envs: input.envs,
      envId: input.envId,
      resolvedImports: coreResolved,
      dev: input.dev,
    },
    {
      importAttrAllow: [],
      generateModuleOutput: false,
      sourceMap: input.sourceMap
        ? {
            sourceFileName: input.sourceMap.sourceFileName,
            sourcesContent: input.sourceMap.sourcesContent,
            embedCellSourcesContent: false,
          }
        : undefined,
    },
    prepared,
  );

  const cssOutputId = `${input.moduleIdentity}::css-dependency`;
  extraOutputs["bundler-css"] = {
    outputId: cssOutputId,
    type: "css-dependency",
    metadata: {
      module: analysis.isModule,
      classes: analysis.classes,
      cells: cellMetadata,
      rootCellId: previousCellId,
      references: dedupeReferences(allReferences),
    },
  };

  return {
    ...coreResult,
    fileRecord: coreResult.fileRecord
      ? {
          ...coreResult.fileRecord,
          extraOutputs,
          linkReferences: dedupeReferences(allReferences),
          cells: coreResult.fileRecord.cells.map((cell) => ({
            ...cell,
            resourceDeps:
              analysis.isModule && previousCellId
                ? [cssOutputId, previousCellId]
                : cell.resourceDeps,
          })),
        }
      : undefined,
  };
}

function replaceCssUrlPlaceholder(
  css: string,
  placeholder: string,
  replacement: string,
): string {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`url\\(\\s*(["']?)${escaped}\\1\\s*\\)`, "g");
  const replaced = css.replace(pattern, replacement);
  if (replaced === css) {
    throw new Error(
      `Could not locate transformed CSS URL placeholder '${placeholder}'.`,
    );
  }
  return replaced;
}

function emitCssFacade(analysis: CssAnalysis, imports: string[]): string {
  if (!analysis.isModule) {
    return `${imports.join("\n")}\nvoid 0;`;
  }
  const properties = Object.entries(analysis.exports).map(([name, value]) => {
    const parts = [JSON.stringify(value.name)];
    for (const [index, composition] of value.composes.entries()) {
      if (composition.type === "global") {
        parts.push(JSON.stringify(composition.name));
      } else if (composition.type === "local") {
        parts.push(
          JSON.stringify(
            analysis.classes[composition.name] ?? composition.name,
          ),
        );
      } else {
        parts.push(
          `__bundler_css_compose_${safeIdentifier(value.name)}_${index}`,
        );
      }
    }
    return `${JSON.stringify(name)}: ${parts.join(' + " " + ')}`;
  });
  const named = Object.keys(analysis.exports)
    .filter(isValidIdentifier)
    .sort()
    .map(
      (name) =>
        `export const ${name} = __bundler_css_classes__[${JSON.stringify(name)}];`,
    );
  return `${imports.join("\n")}
const __bundler_css_classes__ = { ${properties.join(", ")} };
export default __bundler_css_classes__;
${named.join("\n")}`;
}

function mapFacadeResolutions(
  requests: Array<{
    key: string;
    request: string;
    importAttributes?: Record<string, string>;
  }>,
  resolved: Record<string, TransformResolvedImport>,
): Record<string, TransformResolvedImport> {
  return Object.fromEntries(
    requests.map((request) => {
      const cssKey =
        request.importAttributes?.as === "url"
          ? `css-url:${request.request}`
          : `css-import:${request.request}`;
      const value = resolved[cssKey];
      if (!value) {
        throw new Error(
          `Missing resolved CSS dependency '${request.request}'.`,
        );
      }
      return [request.key, value];
    }),
  );
}

function requireFileResolution(
  resolution: TransformResolvedImport | undefined,
  request: string,
  owner: string,
): TransformResolvedImport & {
  target: { kind: "file"; moduleId: string; canonicalPath: string };
} {
  if (!resolution || resolution.target.kind !== "file") {
    throw new Error(
      `CSS dependency '${request}' from '${owner}' did not resolve to a file.`,
    );
  }
  return resolution as TransformResolvedImport & {
    target: { kind: "file"; moduleId: string; canonicalPath: string };
  };
}

function readAssetId(
  resolution: TransformResolvedImport,
  request: string,
): string {
  const assetId = resolution.meta?.assetId;
  if (typeof assetId !== "string") {
    throw new Error(
      `CSS URL '${request}' resolved without a portable asset identity.`,
    );
  }
  return assetId;
}

function parseImportRule(raw: string, filename: string): CssImport {
  const result = lightningTransform({
    filename,
    code: Buffer.from(raw),
    minify: false,
    analyzeDependencies: true,
  });
  const dependency = (result.dependencies ?? []).find(
    (item): item is ImportDependency => item.type === "import",
  );
  if (!dependency) {
    throw new Error(`Could not parse CSS import rule: ${raw}`);
  }
  return {
    request: dependency.url,
    raw,
    media: dependency.media ?? null,
    supports: dependency.supports ?? null,
    layer: extractLayerQualifier(raw),
  };
}

function extractLayerQualifier(raw: string): string | null {
  let quote: string | null = null;
  let comment = false;
  let depth = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    const next = raw[index + 1];
    if (comment) {
      if (current === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = null;
      continue;
    }
    if (current === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }
    if (current === "(") {
      depth += 1;
      continue;
    }
    if (current === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (
      depth === 0 &&
      raw.slice(index, index + 5).toLowerCase() === "layer" &&
      !/[A-Za-z0-9_-]/.test(raw[index - 1] ?? "") &&
      !/[A-Za-z0-9_-]/.test(raw[index + 5] ?? "")
    ) {
      let cursor = index + 5;
      while (/\s/.test(raw[cursor] ?? "")) cursor += 1;
      if (raw[cursor] !== "(") return "";
      const start = cursor + 1;
      let nested = 1;
      cursor += 1;
      while (cursor < raw.length && nested > 0) {
        if (raw[cursor] === "(") nested += 1;
        else if (raw[cursor] === ")") nested -= 1;
        cursor += 1;
      }
      if (nested !== 0)
        throw new Error(`Unterminated CSS layer qualifier: ${raw}`);
      return raw.slice(start, cursor - 1).trim();
    }
  }
  return null;
}

function splitTopLevelImports(
  source: string,
): Array<{ kind: "text" | "import"; value: string }> {
  const result: Array<{ kind: "text" | "import"; value: string }> = [];
  let depth = 0;
  let quote: string | null = null;
  let comment = false;
  let textStart = 0;
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (comment) {
      if (current === "*" && next === "/") {
        comment = false;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (current === "\\") {
        index += 2;
      } else {
        if (current === quote) quote = null;
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      comment = true;
      index += 2;
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      index += 1;
      continue;
    }
    if (current === "{") {
      depth += 1;
      index += 1;
      continue;
    }
    if (current === "}") {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (
      depth === 0 &&
      source.slice(index, index + 7).toLowerCase() === "@import" &&
      !/[A-Za-z0-9_-]/.test(source[index + 7] ?? "")
    ) {
      if (index > textStart) {
        result.push({ kind: "text", value: source.slice(textStart, index) });
      }
      const end = findRuleEnd(source, index + 7);
      result.push({ kind: "import", value: source.slice(index, end) });
      index = end;
      textStart = end;
      continue;
    }
    index += 1;
  }
  if (textStart < source.length) {
    result.push({ kind: "text", value: source.slice(textStart) });
  }
  return result;
}

function findRuleEnd(source: string, start: number): number {
  let quote: string | null = null;
  let comment = false;
  let parens = 0;
  for (let index = start; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (comment) {
      if (current === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = null;
      continue;
    }
    if (current === "/" && next === "*") {
      comment = true;
      index += 1;
    } else if (current === '"' || current === "'") {
      quote = current;
    } else if (current === "(") {
      parens += 1;
    } else if (current === ")") {
      parens = Math.max(0, parens - 1);
    } else if (current === ";" && parens === 0) {
      return index + 1;
    }
  }
  throw new Error("Unterminated CSS @import rule.");
}

function renameSelectorClasses(
  components: unknown[],
  canonicalPath: string,
  buildMode: string,
  desiredByOriginal: Map<string, string>,
  originalByDesired: Map<string, string>,
  local: boolean,
): void {
  for (const raw of components) {
    if (!raw || typeof raw !== "object") continue;
    const component = raw as Record<string, unknown>;
    const kind = component.kind;
    if (
      component.type === "class" &&
      local &&
      typeof component.name === "string"
    ) {
      const original = component.name;
      const desired =
        desiredByOriginal.get(original) ??
        cssModuleName(canonicalPath, original, buildMode);
      desiredByOriginal.set(original, desired);
      originalByDesired.set(desired, original);
      component.name = desired;
    }
    const nested = component.selector;
    if (Array.isArray(nested)) {
      renameSelectorClasses(
        nested,
        canonicalPath,
        buildMode,
        desiredByOriginal,
        originalByDesired,
        kind === "global" ? false : kind === "local" ? true : local,
      );
    }
  }
}

function cssModuleName(
  canonicalPath: string,
  localName: string,
  buildMode: string,
): string {
  if (buildMode !== "production") {
    return `${contentHashShort(canonicalPath)}_${localName}`;
  }
  const raw = contentHashShort(`${canonicalPath}_${localName}`, 8).padEnd(
    8,
    "0",
  );
  if (!/^\d/.test(raw)) return raw;
  return `${String.fromCharCode(97 + Number(raw[0]))}${raw.slice(1)}`;
}

function isLocalCssRequest(request: string): boolean {
  return !/^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/|#)/.test(request);
}

function dedupeRequests(
  requests: CssDependencyRequest[],
): CssDependencyRequest[] {
  return Array.from(new Map(requests.map((item) => [item.key, item])).values());
}

function dedupeReferences(references: LinkReference[]): LinkReference[] {
  return Array.from(
    new Map(references.map((item) => [item.id, item])).values(),
  );
}

function safeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_$]/g, "_");
}

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function normalizeCssMap(map: string, sourcesContent: boolean): string {
  const parsed = JSON.parse(map) as Record<string, unknown>;
  if (!sourcesContent) delete parsed.sourcesContent;
  return JSON.stringify(parsed);
}
