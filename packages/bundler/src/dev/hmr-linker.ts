import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { CellRecord, ModuleNode } from "@bundler/shared";
import { contentHashShort } from "@bundler/shared";
import { assembleBundle, stringifySourceMap } from "../sourcemap/compose.js";

export type HmrCellRecord = {
  id: string;
  symbols: string[];
  deps: string[];
  hash: string;
  code: string;
  map?: string;
  patchCode?: string;
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
    async applyPatch(records, imports, styles) {
      try {
        for (const source of records) (0, eval)(source);
        for (const href of imports || []) {
          const module = await import(href);
          runtime.updateRscModuleCache(href, module);
        }
        runtime.updateStyles(styles || []);
        if ((records.length > 0 || (imports || []).length > 0) && !runtime.performReactRefresh()) location.reload();
      } catch (error) {
        console.error("[bundler] HMR patch failed", error);
        location.reload();
      }
    },
    updateStyles(styles) {
      if (typeof document === "undefined") return;
      for (const href of styles) {
        const url = new URL(href, location.href);
        const fileName = url.pathname.split("/").pop();
        const styleKey = url.searchParams.get("key") || fileName;
        if (!fileName) continue;
        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) => {
          const current = new URL(link.href, location.href);
          return current.pathname.split("/").pop() === fileName || link.getAttribute("data-bundler-style") === styleKey;
        });
        if (existing) {
          existing.href = href;
          continue;
        }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute("data-bundler-style", styleKey);
        document.head.appendChild(link);
      }
    },
    updateRscModuleCache(href, module) {
      if (typeof URL !== "function" || typeof location === "undefined") return;
      const url = new URL(href, location.href);
      const rscId = url.searchParams.get("rsc-id");
      if (!rscId) return;
      const fileName = url.searchParams.get("hmr") || url.pathname.split("/").pop();
      const chunks = globalThis.__BUNDLER_RSC_CHUNKS__ ??= {};
      if (fileName) chunks[rscId] = fileName;
      const cache = globalThis.__BUNDLER_RSC_MODULE_CACHE__;
      if (!cache || typeof cache.set !== "function") return;
      cache.set(rscId, module);
      if (fileName) cache.set(fileName, module);
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
    refreshRsc() {
      if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
        const event = new CustomEvent("bundler:rsc-refresh", { cancelable: true });
        globalThis.dispatchEvent(event);
        if (event.defaultPrevented) return;
      }
      location.reload();
    },
    connect() {
      if (typeof WebSocket !== "function" || typeof location === "undefined") return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(protocol + "//" + location.host + "/__bundler_hmr");
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "patch") runtime.applyPatch(message.records || [], message.imports || [], message.styles || []);
        if (message.type === "rsc-refresh") runtime.refreshRsc();
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
  const sourceMap = await readCellMap(cell);
  const symbols = cell.provides;
  const deps = collectIdentifierDeps(cell, extraDeps);
  const installer = wrapCellInstaller(cell, source, sourceMap, symbols, deps);
  const id = cellIdentifier(cell);
  return {
    id,
    symbols,
    deps,
    hash: contentHashShort(source),
    code: installer.code,
    map: installer.map,
    patchCode: emitPatchCode(installer.code, installer.map, id),
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

async function readCellMap(cell: CellRecord): Promise<string | undefined> {
  if (cell.map != null) {
    return cell.map;
  }
  if (cell.mapArtifactPath) {
    const fs = await import("node:fs/promises");
    return fs.readFile(cell.mapArtifactPath, "utf8");
  }
  return undefined;
}

function wrapCellInstaller(
  cell: CellRecord,
  source: string,
  sourceMap: string | undefined,
  symbols: string[],
  deps: string[],
): { code: string; map?: string } {
  if (isTopLevelModuleSyntax(source)) {
    return { code: source, map: sourceMap };
  }
  const refreshRegistrations = symbols
    .filter(isPotentialComponentSymbol)
    .map(
      (symbol) =>
        `__BUNDLER_HMR__.reactRefreshRegister(${symbol}, ${JSON.stringify(symbol)});`,
    );
  const opening = `__BUNDLER_HMR__.register({
  id: ${JSON.stringify(cellIdentifier(cell))},
  symbols: ${JSON.stringify(symbols)},
  deps: ${JSON.stringify(deps)},
  hash: ${JSON.stringify(contentHashShort(source))},
  install() {`;
  const assembled = assembleBundle([
    { code: opening },
    { code: source, map: sourceMap },
    ...(refreshRegistrations.length > 0
      ? [{ code: refreshRegistrations.join("\n") }]
      : []),
    { code: "  }\n});" },
  ]);
  return {
    code: assembled.code,
    map: sourceMap ? stringifySourceMap(assembled.map) : undefined,
  };
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
  return /^[A-Z]/.test(exported) || isPotentialComponentSymbol(symbol);
}

function isPotentialComponentSymbol(symbol: string): boolean {
  return /^[A-Z]/.test(symbol) || /^[a-z0-9]+_[A-Z]/.test(symbol);
}

function emitPatchCode(
  code: string,
  map: string | undefined,
  id: string,
): string {
  if (!map) {
    return code;
  }
  const encodedMap = Buffer.from(map, "utf8").toString("base64");
  const sourceUrl = `bundler-hmr:///${encodeURIComponent(id)}.js`;
  return `${code}\n//# sourceURL=${sourceUrl}\n//# sourceMappingURL=data:application/json;base64,${encodedMap}`;
}

function indent(source: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return source
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
}
