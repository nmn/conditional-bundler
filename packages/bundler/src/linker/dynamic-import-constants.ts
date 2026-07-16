import { joinRootURL } from "../output-url.js";

export type BundleTarget = {
  fileName: string;
  exportMode: "entry" | "dynamic";
};

export type DynamicImportRuntime = {
  hashKey: string;
  resolvedId: string | null;
  externalRequest?: string;
  exports: Array<{ exported: string; symbol: string }>;
};

export function emitDynamicImportConstants(
  imports: DynamicImportRuntime[],
  bundleMap: Map<string, BundleTarget>,
  envId?: string,
  stylesByBundle: Map<string, string[]> = new Map(),
  rootURL = "/",
): string {
  const lines: string[] = [];
  const emitted = new Set<string>();
  let emittedCssRuntime = false;

  for (const dynamicImport of imports) {
    if (emitted.has(dynamicImport.hashKey)) {
      continue;
    }
    emitted.add(dynamicImport.hashKey);

    if (dynamicImport.resolvedId == null) {
      if (!dynamicImport.externalRequest) {
        continue;
      }
      lines.push(
        `const ${dynamicImport.hashKey} = () => import(${JSON.stringify(dynamicImport.externalRequest)});`,
      );
      continue;
    }

    const target =
      (envId ? bundleMap.get(`${envId}:${dynamicImport.resolvedId}`) : null) ??
      bundleMap.get(dynamicImport.resolvedId);
    if (!target) {
      continue;
    }

    const specifier = normalizeChunkSpecifier(target.fileName);
    const styleKey = `${envId ?? "default"}:${dynamicImport.resolvedId}`;
    const styles = stylesByBundle.get(styleKey) ?? [];
    if (styles.length > 0 && !emittedCssRuntime) {
      emittedCssRuntime = true;
      lines.push(
        "const __bundler_css_loads__ = globalThis.__BUNDLER_CSS_LOADS__ ??= new Map();",
        'const __bundler_load_css__ = (href) => { let pending = __bundler_css_loads__.get(href); if (pending) return pending; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; pending = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; }); __bundler_css_loads__.set(href, pending); document.head.appendChild(link); return pending; };',
      );
    }
    const importExpression = `import(${JSON.stringify(specifier)})`;
    const loadExpression =
      styles.length > 0
        ? `Promise.all([${styles
            .map(
              (fileName) =>
                `__bundler_load_css__(${JSON.stringify(
                  joinRootURL(rootURL, fileName),
                )})`,
            )
            .join(", ")}]).then(() => ${importExpression})`
        : importExpression;
    if (target.exportMode === "entry") {
      lines.push(`const ${dynamicImport.hashKey} = () => ${loadExpression};`);
      continue;
    }

    const exportMappings = dynamicImport.exports
      .map(
        (exportEntry) =>
          `${JSON.stringify(exportEntry.exported)}: mod[${JSON.stringify(exportEntry.symbol)}]`,
      )
      .join(", ");

    lines.push(
      `const ${dynamicImport.hashKey} = () => ${loadExpression}.then((mod) => Object.freeze({ ${exportMappings} }));`,
    );
  }

  return lines.join("\n");
}

function normalizeChunkSpecifier(fileName: string): string {
  if (
    fileName.startsWith("./") ||
    fileName.startsWith("../") ||
    fileName.startsWith("/") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(fileName)
  ) {
    return fileName;
  }
  return `./${fileName}`;
}
