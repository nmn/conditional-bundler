import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { CellRecord, ModuleNode } from "@bundler/shared";
import { contentHashShort } from "@bundler/shared";

export type HmrCellRecord = {
  id: string;
  symbols: string[];
  deps: string[];
  hash: string;
  code: string;
};

export type HmrBundleRecord = {
  envId: string;
  entryId: string;
  reactRefresh: boolean;
  symbols: string[];
  cells: HmrCellRecord[];
};

const requireFromBundler = createRequire(import.meta.url);

export function emitHmrPrelude(options: {
  connect: boolean;
  reactRefresh?: boolean;
}): string {
  return `${options.reactRefresh ? emitReactRefreshRuntimeSetup() : ""}
const __BUNDLER_HMR__ = globalThis.__BUNDLER_HMR__ ??= (() => {
  const cells = new Map();
  const data = Object.create(null);
  let activeCellId = null;
  const runtime = {
    hot(id) {
      const ownerId = activeCellId || id;
      const hotData = data[ownerId] ??= {};
      return {
        data: hotData,
        accept(callback) {
          const cell = cells.get(ownerId);
          if (cell) cell.accept = callback || true;
        },
        dispose(callback) {
          const cell = cells.get(ownerId);
          if (cell) cell.dispose = callback;
        },
        invalidate() {
          location.reload();
        }
      };
    },
    register(record) {
      const previous = cells.get(record.id);
      if (previous?.dispose) previous.dispose(data[record.id] ??= {});
      cells.set(record.id, { ...previous, ...record });
      activeCellId = record.id;
      try {
        record.install();
      } finally {
        activeCellId = null;
      }
      if (previous?.accept) queueMicrotask(() => {
        if (typeof previous.accept === "function") previous.accept();
        runtime.performReactRefresh();
      });
    },
    async applyPatch(records) {
      try {
        for (const source of records) (0, eval)(source);
        if (!runtime.performReactRefresh()) location.reload();
      } catch (error) {
        console.error("[bundler] HMR patch failed", error);
        location.reload();
      }
    },
    reactRefreshRegister(type, id) {
      const register = globalThis.$RefreshReg$;
      if (typeof register === "function" && type) register(type, id);
    },
    performReactRefresh() {
      const refresh = globalThis.$RefreshRuntime$;
      if (refresh && typeof refresh.performReactRefresh === "function") {
        refresh.performReactRefresh();
        return true;
      }
      return false;
    },
    connect() {
      if (typeof WebSocket !== "function" || typeof location === "undefined") return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(protocol + "//" + location.host + "/__bundler_hmr");
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "patch") runtime.applyPatch(message.records || []);
        if (message.type === "reload") location.reload();
        if (message.type === "error") console.error("[bundler] rebuild failed", message.message);
      });
      socket.addEventListener("close", () => setTimeout(() => runtime.connect(), 1000));
    }
  };
  return runtime;
})();${options.connect ? "\n__BUNDLER_HMR__.connect();" : ""}`;
}

export async function emitHmrCell(
  cell: CellRecord,
  extraDeps: string[] = [],
): Promise<HmrCellRecord> {
  const source = await readCellCode(cell);
  const symbols = cell.provides;
  const deps = collectIdentifierDeps(cell, extraDeps);
  const installer = wrapCellInstaller(cell, source, symbols, deps);
  return {
    id: cellIdentifier(cell),
    symbols,
    deps,
    hash: contentHashShort(source),
    code: installer,
  };
}

export function emitHmrSymbolDeclarations(symbols: Iterable<string>): string {
  const unique = Array.from(new Set(symbols)).sort();
  if (unique.length === 0) {
    return "";
  }
  return `let ${unique.join(", ")};`;
}

export function emitHmrExportFooter(node: ModuleNode | undefined): string {
  if (!node?.exportTable || node.exportTable.size === 0) {
    return "";
  }
  const parts: string[] = [];
  for (const [exported, provider] of node.exportTable.entries()) {
    parts.push(provider.symbol);
    if (provider.symbol !== exported) {
      parts.push(`${provider.symbol} as ${exported}`);
    }
  }
  return `export { ${parts.join(", ")} };`;
}

export function emitReactRefreshRegistrations(
  node: ModuleNode,
  selectedCells?: Set<string>,
): string {
  if (!node.exportTable || node.exportTable.size === 0) {
    return "";
  }
  const lines: string[] = [];
  for (const [exported, provider] of node.exportTable.entries()) {
    if (selectedCells && !selectedCells.has(provider.cellId)) {
      continue;
    }
    if (!isPotentialComponentExport(exported, provider.symbol)) {
      continue;
    }
    lines.push(
      `__BUNDLER_HMR__.reactRefreshRegister(${provider.symbol}, ${JSON.stringify(provider.symbol)});`,
    );
  }
  return lines.join("\n");
}

export function emitHmrBundleMetadata(
  record: HmrBundleRecord,
): HmrBundleRecord {
  return record;
}

function emitReactRefreshRuntimeSetup(): string {
  const runtimeSource = readReactRefreshRuntimeSource();
  if (!runtimeSource) {
    return `console.warn("[bundler] react-refresh/runtime is not available; HMR patches will reload.");`;
  }
  return `if (!globalThis.$RefreshRuntime$) {
  const __BUNDLER_REFRESH_MODULE__ = { exports: {} };
  (() => {
    const module = __BUNDLER_REFRESH_MODULE__;
    const exports = module.exports;
    const process = { env: { NODE_ENV: "development" } };
${indent(runtimeSource, 4)}
  })();
  const __BUNDLER_REFRESH_RUNTIME__ = __BUNDLER_REFRESH_MODULE__.exports;
  if (__BUNDLER_REFRESH_RUNTIME__ && typeof __BUNDLER_REFRESH_RUNTIME__.injectIntoGlobalHook === "function") {
    __BUNDLER_REFRESH_RUNTIME__.injectIntoGlobalHook(globalThis);
    globalThis.$RefreshRuntime$ = __BUNDLER_REFRESH_RUNTIME__;
    globalThis.$RefreshReg$ = (type, id) => __BUNDLER_REFRESH_RUNTIME__.register(type, id);
    globalThis.$RefreshSig$ = __BUNDLER_REFRESH_RUNTIME__.createSignatureFunctionForTransform;
  }
}`;
}

function readReactRefreshRuntimeSource(): string | null {
  try {
    const runtimeEntry = requireFromBundler.resolve("react-refresh/runtime");
    const runtimeDir = path.dirname(runtimeEntry);
    return fs.readFileSync(
      path.join(runtimeDir, "cjs", "react-refresh-runtime.development.js"),
      "utf8",
    );
  } catch {
    return null;
  }
}

async function readCellCode(cell: CellRecord): Promise<string> {
  if (cell.code != null) {
    return cell.code;
  }
  if (cell.artifactPath) {
    const fs = await import("node:fs/promises");
    return fs.readFile(cell.artifactPath, "utf8");
  }
  throw new Error(`Cell '${cell.id}' is missing code and artifactPath.`);
}

function wrapCellInstaller(
  cell: CellRecord,
  source: string,
  symbols: string[],
  deps: string[],
): string {
  if (isTopLevelModuleSyntax(source)) {
    return source;
  }
  return `__BUNDLER_HMR__.register({
  id: ${JSON.stringify(cellIdentifier(cell))},
  symbols: ${JSON.stringify(symbols)},
  deps: ${JSON.stringify(deps)},
  hash: ${JSON.stringify(contentHashShort(source))},
  install() {
${indent(rewriteProvidedDeclarations(source, symbols), 4)}
  }
});`;
}

function rewriteProvidedDeclarations(
  source: string,
  symbols: string[],
): string {
  let output = source;
  for (const symbol of symbols) {
    const escaped = escapeRegExp(symbol);
    output = output.replace(
      new RegExp(`\\b(?:const|let|var)\\s+(${escaped})\\s*=`, "g"),
      "$1 =",
    );
    output = output.replace(
      new RegExp(`\\basync\\s+function\\s+(${escaped})\\s*\\(`, "g"),
      "$1 = async function $1(",
    );
    output = output.replace(
      new RegExp(`(?<!async\\s)\\bfunction\\s+(${escaped})\\s*\\(`, "g"),
      "$1 = function $1(",
    );
    output = output.replace(
      new RegExp(`\\bclass\\s+(${escaped})(\\s|\\{)`, "g"),
      "$1 = class $1$2",
    );
  }
  return output;
}

function collectIdentifierDeps(
  cell: CellRecord,
  extraDeps: string[],
): string[] {
  const deps = new Set<string>(cell.internalDeps);
  for (const provider of cell.providerDeps ?? []) {
    deps.add(provider.symbol);
  }
  for (const dep of extraDeps) {
    deps.add(dep);
  }
  return Array.from(deps).sort();
}

function cellIdentifier(cell: CellRecord): string {
  return cell.provides[0] ?? cell.id;
}

function isTopLevelModuleSyntax(source: string): boolean {
  return /^\s*(import|export)\s/m.test(source);
}

function isPotentialComponentExport(exported: string, symbol: string): boolean {
  if (exported === "default") {
    return true;
  }
  return /^[A-Z]/.test(exported) || /^[a-z0-9]+_[A-Z]/.test(symbol);
}

function indent(source: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return source
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
