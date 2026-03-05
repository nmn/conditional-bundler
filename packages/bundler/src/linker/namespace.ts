import type { ModuleNode } from "@bundler/shared";

export function emitNamespaceObject(node: ModuleNode): string {
  const entries = node.exportTable ? Array.from(node.exportTable.keys()) : [];
  const lines: string[] = [];
  const nsVar = `__NS__${node.prefix}`;
  lines.push(`const ${nsVar} = Object.create(null);`);
  lines.push(
    `Object.defineProperty(${nsVar}, Symbol.toStringTag, { value: "Module" });`,
  );
  for (const name of entries) {
    if (name === "default") {
      continue;
    }
    lines.push(
      `Object.defineProperty(${nsVar}, "${name}", { enumerable: true, get: () => ${node.prefix}_${name} });`,
    );
  }
  lines.push(`Object.preventExtensions(${nsVar});`);
  return lines.join("\n");
}
