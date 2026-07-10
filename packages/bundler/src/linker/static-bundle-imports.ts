import type { BundleTarget } from "./dynamic-import-constants.js";

export type StaticBundleImport = {
  entryId: string;
  symbols: string[];
};

export function emitStaticBundleImports(
  imports: StaticBundleImport[],
  bundleMap: Map<string, BundleTarget>,
  envId: string,
): string {
  const lines: string[] = [];

  for (const bundleImport of [...imports].sort((left, right) =>
    left.entryId.localeCompare(right.entryId),
  )) {
    const target =
      bundleMap.get(`${envId}:${bundleImport.entryId}`) ??
      bundleMap.get(bundleImport.entryId);
    if (!target) {
      throw new Error(
        `Missing bundle for static dependency '${bundleImport.entryId}' in '${envId}'.`,
      );
    }

    const specifier = normalizeChunkSpecifier(target.fileName);
    const symbols = Array.from(new Set(bundleImport.symbols)).sort();
    lines.push(
      symbols.length > 0
        ? `import { ${symbols.join(", ")} } from ${JSON.stringify(specifier)};`
        : `import ${JSON.stringify(specifier)};`,
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
