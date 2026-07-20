export type BundleTarget = {
  fileName: string;
  exportMode: "entry" | "dynamic";
  /** Static script dependency closure, excluding fileName itself. */
  dependencyFileNames?: string[];
};

export type StaticBundleImport = {
  entryId: string;
  symbols: string[];
};

export function emitStaticBundleImports(
  imports: StaticBundleImport[],
  bundleMap: Map<string, BundleTarget>,
  envId: string,
  fromFileName?: string,
  mapScriptFileName: (fileName: string) => string = (fileName) => fileName,
): string {
  const lines: string[] = [];

  for (const bundleImport of imports) {
    const target = bundleMap.get(`${envId}:${bundleImport.entryId}`);
    if (!target) {
      throw new Error(
        `Missing bundle for static dependency '${bundleImport.entryId}' in '${envId}'.`,
      );
    }

    const targetFileName = mapScriptFileName(target.fileName);
    const specifier = fromFileName
      ? relativeChunkSpecifier(fromFileName, targetFileName)
      : normalizeChunkSpecifier(targetFileName);
    const symbols = Array.from(new Set(bundleImport.symbols)).sort();
    lines.push(
      symbols.length > 0
        ? `import { ${symbols.join(", ")} } from ${JSON.stringify(specifier)};`
        : `import ${JSON.stringify(specifier)};`,
    );
  }

  return lines.join("\n");
}

function relativeChunkSpecifier(
  fromFileName: string,
  targetFileName: string,
): string {
  return normalizeChunkSpecifier(
    path.posix.relative(path.posix.dirname(fromFileName), targetFileName),
  );
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
import path from "node:path";
