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
): string {
  const lines: string[] = [];
  const emitted = new Set<string>();

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
    const importExpression = `import(${JSON.stringify(specifier)})`;
    if (target.exportMode === "entry") {
      lines.push(`const ${dynamicImport.hashKey} = () => ${importExpression};`);
      continue;
    }

    const exportMappings = dynamicImport.exports
      .map(
        (exportEntry) =>
          `${JSON.stringify(exportEntry.exported)}: mod[${JSON.stringify(exportEntry.symbol)}]`,
      )
      .join(", ");

    lines.push(
      `const ${dynamicImport.hashKey} = () => ${importExpression}.then((mod) => Object.freeze({ ${exportMappings} }));`,
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
