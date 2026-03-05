import type { DynamicImport } from "@bundler/shared";

export function emitDynamicImportConstants(
  imports: DynamicImport[],
  bundleMap: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const dynamicImport of imports) {
    const target = bundleMap[dynamicImport.hashKey];
    if (!target) {
      continue;
    }
    lines.push(`const ${dynamicImport.hashKey} = () => import("${target}");`);
  }
  return lines.join("\n");
}
