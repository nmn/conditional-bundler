import type { ModuleNode } from "@bundler/shared";

export function emitNamespaceObject(node: ModuleNode): string {
  const entries = node.exportTable ? Array.from(node.exportTable.entries()) : [];
  const lines: string[] = [];
  const nsVar = `__NS__${node.prefix}`;
  lines.push(`const ${nsVar} = Object.create(null);`);
  lines.push(
    `Object.defineProperty(${nsVar}, Symbol.toStringTag, { value: "Module" });`,
  );
  for (const [name, provider] of entries) {
    lines.push(
      `Object.defineProperty(${nsVar}, ${JSON.stringify(name)}, { enumerable: true, get: () => ${provider.symbol} });`,
    );
  }
  lines.push(`Object.preventExtensions(${nsVar});`);
  return lines.join("\n");
}
