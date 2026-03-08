export type BundleTarget = {
  fileName: string;
  exportMode: "entry" | "dynamic";
};

export type DynamicImportRuntime = {
  hashKey: string;
  resolvedId: string;
  exports: Array<{ exported: string; symbol: string }>;
};

export function emitDynamicImportConstants(
  imports: DynamicImportRuntime[],
  bundleMap: Map<string, BundleTarget>,
): string {
  const lines: string[] = [];
  const emitted = new Set<string>();

  for (const dynamicImport of imports) {
    if (emitted.has(dynamicImport.hashKey)) {
      continue;
    }
    emitted.add(dynamicImport.hashKey);

    const target = bundleMap.get(dynamicImport.resolvedId);
    if (!target) {
      continue;
    }

    const specifier = normalizeChunkSpecifier(target.fileName);
    if (target.exportMode === "entry") {
      lines.push(
        `const ${dynamicImport.hashKey} = () => import(${JSON.stringify(specifier)});`,
      );
      continue;
    }

    lines.push(
      `const ${dynamicImport.hashKey} = () => import(${JSON.stringify(specifier)}).then((mod) => {`,
      "  const ns = Object.create(null);",
      '  Object.defineProperty(ns, Symbol.toStringTag, { value: "Module" });',
    );

    for (const exportEntry of dynamicImport.exports) {
      lines.push(
        `  Object.defineProperty(ns, ${JSON.stringify(exportEntry.exported)}, { enumerable: true, get: () => mod[${JSON.stringify(exportEntry.symbol)}] });`,
      );
    }

    lines.push("  Object.preventExtensions(ns);", "  return ns;", "});");
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
