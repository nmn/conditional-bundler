import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import { buildProject, type BuildResult } from "../builder.js";
import { parseBuildScopeId, type BundlerConfig } from "../config.js";
import { materializeHmrPatch, type HmrCellRecord } from "./hmr-linker.js";
import { resolveDevOptions } from "./options.js";
import { readDevAsset, resolveConditionalCode } from "./conditional-assets.js";

export type DevServer = {
  url: string;
  close: () => Promise<void>;
};

export const hmrUpdatePrefix = "/__bundler_hmr_updates/";
const hmrUpdateLifetimeMs = 60_000;

export type HmrPatchPlan = {
  type: "patch";
  updates: Array<{ bundleKey: string; cell: HmrCellRecord }>;
  changedBundles: string[];
  imports?: string[];
  styles?: string[];
  rscModules?: string[];
};

export type HmrPatchOptions = {
  ignoreManifestResources?: boolean;
};

export type HmrMessage =
  | {
      type: "patch";
      updates: Array<{ bundleKey: string; url: string }>;
      changedBundles: string[];
      imports?: string[];
      styles?: string[];
      rscModules?: string[];
    }
  | { type: "rsc-refresh"; styles?: string[] }
  | { type: "reload" }
  | { type: "error"; message: string };

export type Client = {
  socket: Socket;
};

export type RebuildScheduler = {
  notify: () => void;
  close: () => void;
};

type HmrUpdateResource = {
  body: string;
  expiresAt: number;
};

export class HmrUpdateStore {
  private generation = 0;
  private readonly resources = new Map<string, HmrUpdateResource>();

  async publish(
    patch: HmrPatchPlan,
  ): Promise<Extract<HmrMessage, { type: "patch" }>> {
    this.prune();
    const generation = ++this.generation;
    const updates = await Promise.all(
      patch.updates.map(async ({ bundleKey, cell }, index) => {
        const body = await resolveConditionalCode(
          await materializeHmrPatch(cell),
        );
        const token = createHash("sha256")
          .update(`${generation}:${index}:${bundleKey}:${cell.id}:${cell.hash}`)
          .digest("hex")
          .slice(0, 24);
        const url = `${hmrUpdatePrefix}${generation}/${token}.js`;
        this.resources.set(url, {
          body,
          expiresAt: Date.now() + hmrUpdateLifetimeMs,
        });
        return { bundleKey, url };
      }),
    );
    return {
      type: "patch",
      updates,
      changedBundles: patch.changedBundles,
      imports: patch.imports,
      styles: patch.styles,
      rscModules: patch.rscModules,
    };
  }

  read(pathname: string): string | null {
    this.prune();
    return this.resources.get(pathname)?.body ?? null;
  }

  clear(): void {
    this.resources.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [url, resource] of this.resources) {
      if (resource.expiresAt <= now) {
        this.resources.delete(url);
      }
    }
  }
}

export async function startDevServer(
  config: BundlerConfig,
): Promise<DevServer> {
  const devConfig: BundlerConfig = {
    ...config,
    dev: {
      hmr: true,
      reactRefresh: true,
      fullReloadOnFailure: true,
      ...(config.dev ?? {}),
    },
  };
  const devOptions = await resolveDevOptions(devConfig, devConfig.entries);
  let current = await buildProject(devConfig, []);
  const clients = new Set<Client>();
  const hmrUpdates = new HmrUpdateStore();
  const server = http.createServer((request, response) => {
    void handleRequest(devConfig, current, hmrUpdates, request, response);
  });
  server.on("upgrade", (request, socket) => {
    if (request.url !== "/__bundler_hmr") {
      socket.destroy();
      return;
    }
    acceptWebSocket(request, socket as Socket, clients);
  });

  await new Promise<void>((resolve) => {
    server.listen(devOptions.port, devOptions.host, resolve);
  });

  const watcher = watchProject(devConfig, async () => {
    try {
      const next = await buildProject(devConfig, []);
      const patch = filterPatchForBrowser(
        createPatch(current, next),
        next,
        devConfig,
      );
      current = next;
      broadcast(
        clients,
        patch ? await hmrUpdates.publish(patch) : { type: "reload" },
      );
    } catch (error) {
      console.error("[bundler] rebuild failed", error);
      if (devOptions.fullReloadOnFailure) {
        broadcast(clients, { type: "reload" });
      }
    }
  });

  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : devOptions.port;
  return {
    url: `http://${devOptions.host}:${port}`,
    close: async () => {
      watcher?.close();
      hmrUpdates.clear();
      for (const client of clients) {
        client.socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function filterPatchForBrowser(
  patch: HmrPatchPlan | null,
  build: BuildResult,
  config: BundlerConfig,
): HmrPatchPlan | null {
  if (!patch) {
    return null;
  }
  const isBrowserBundle = (bundleKey: string) => {
    const envId = build.hmr?.bundles[bundleKey]?.envId;
    return envId != null && scopePlatform(config, envId) === "browser";
  };
  return {
    ...patch,
    updates: patch.updates.filter((update) =>
      isBrowserBundle(update.bundleKey),
    ),
    changedBundles: patch.changedBundles.filter(isBrowserBundle),
  };
}

async function handleRequest(
  config: BundlerConfig,
  build: BuildResult,
  hmrUpdates: HmrUpdateStore,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname.startsWith(hmrUpdatePrefix)) {
    const body = hmrUpdates.read(url.pathname);
    if (body == null) {
      response.statusCode = 404;
      response.end("HMR update not found");
      return;
    }
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "text/javascript; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");
    response.end(body);
    return;
  }
  if (url.pathname === "/") {
    const document = build.manifest.documents?.[0];
    if (document) {
      const served = await readDevAsset(config, build, document.fileName);
      if (served) {
        response.setHeader("content-type", served.contentType);
        response.end(served.body);
        return;
      }
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(renderIndex(config, build));
    return;
  }

  const requestedFileName = decodeURIComponent(
    url.pathname.replace(/^\/+/, ""),
  );
  let served = await readDevAsset(config, build, requestedFileName);
  if (!served && requestedFileName.startsWith("assets/")) {
    served = await readDevAsset(
      config,
      build,
      requestedFileName.slice("assets/".length),
    );
  }
  if (!served && request.headers.accept?.includes("text/html")) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(renderIndex(config, build));
    return;
  }
  if (!served) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader("content-type", served.contentType);
  response.end(served.body);
}

function renderIndex(config: BundlerConfig, build: BuildResult): string {
  const styles = (build.manifest.assets ?? [])
    .filter((asset) => asset.type === "style")
    .map(
      (asset) =>
        `<link rel="stylesheet" href="/assets/${escapeHtml(asset.fileName)}" data-bundler-style="${escapeHtml(asset.bundleKey ?? asset.fileName)}">`,
    )
    .join("\n");
  const scripts = build.bundles
    .filter((bundle) => isConfiguredBrowserEntry(config, bundle))
    .map(
      (bundle) =>
        `<script type="module" src="/${escapeHtml(bundle.fileName)}"></script>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>conditional-bundler dev</title>${styles}</head>
  <body><div id="root"></div>${scripts}</body>
</html>`;
}

function isConfiguredBrowserEntry(
  config: BundlerConfig,
  bundle: BuildResult["bundles"][number],
): boolean {
  const entryPath = path.resolve(bundle.entryId);
  return config.entries.some((entry) => {
    if (path.resolve(entry.path) !== entryPath) {
      return false;
    }
    const requestedTargets = entry.targets ?? Object.keys(config.targets);
    return requestedTargets.some(
      (targetId) =>
        (bundle.targetIds ?? []).includes(targetId) &&
        config.targets[targetId]?.platform === "browser",
    );
  });
}

function scopePlatform(config: BundlerConfig, scopeId: string) {
  return config.targets[parseBuildScopeId(scopeId).targetId]?.platform;
}

export function watchProject(
  config: BundlerConfig,
  onChange: () => Promise<void>,
): fs.FSWatcher | null {
  const roots = new Set<string>();
  for (const entry of config.entries) {
    roots.add(path.dirname(path.resolve(entry.path)));
  }
  if (config.configFile) {
    roots.add(path.dirname(path.resolve(config.configFile)));
  }
  const root = commonRoot(Array.from(roots));
  if (!root) {
    return null;
  }
  const ignoredRoots = [
    config.outputs.outDir,
    config.cache?.local?.dir ?? config.cacheDir,
    path.join(root, "node_modules"),
    path.join(root, ".git"),
  ]
    .filter((item): item is string => Boolean(item))
    .map((item) => path.resolve(item));

  const scheduler = createRebuildScheduler(onChange);
  const watcher = fs.watch(
    root,
    { recursive: true },
    (_eventType, fileName) => {
      if (fileName) {
        const changedPath = path.resolve(root, fileName.toString());
        if (
          ignoredRoots.some((ignored) => isPathInside(changedPath, ignored))
        ) {
          return;
        }
      }
      scheduler.notify();
    },
  );
  watcher.once("close", scheduler.close);
  return watcher;
}

export function createRebuildScheduler(
  onChange: () => Promise<void>,
  debounceMs = 50,
): RebuildScheduler {
  let timer: NodeJS.Timeout | undefined;
  let dirty = false;
  let running = false;
  let closed = false;

  const drain = async () => {
    if (running || closed || !dirty) {
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        await onChange();
      } while (dirty && !closed);
    } finally {
      running = false;
    }
  };

  return {
    notify() {
      if (closed) {
        return;
      }
      dirty = true;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        void drain();
      }, debounceMs);
    },
    close() {
      closed = true;
      dirty = false;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export function createPatch(
  previous: BuildResult,
  next: BuildResult,
  options: HmrPatchOptions = {},
): HmrPatchPlan | null {
  if (hasReloadOnlyResourceChanges(previous, next, options)) {
    return null;
  }
  const previousHmr = previous.hmr;
  const nextHmr = next.hmr;
  if (!previousHmr || !nextHmr) {
    return null;
  }
  if (
    !sameStrings(
      Object.keys(previousHmr.bundles).sort(),
      Object.keys(nextHmr.bundles).sort(),
    )
  ) {
    return null;
  }

  const stylePatch = createStylePatch(previous, next);
  if (stylePatch === null) {
    return null;
  }

  const updates: HmrPatchPlan["updates"] = [];
  const changedBundles: string[] = [];
  for (const [key, nextBundle] of Object.entries(nextHmr.bundles)) {
    const previousBundle = previousHmr.bundles[key];
    if (!previousBundle) {
      return null;
    }
    if (!sameStrings(previousBundle.symbols, nextBundle.symbols)) {
      return null;
    }
    if (
      !sameStrings(
        previousBundle.cells.map((cell) => cell.id).sort(),
        nextBundle.cells.map((cell) => cell.id).sort(),
      )
    ) {
      return null;
    }
    const previousCells = new Map(
      previousBundle.cells.map((cell) => [cell.id, cell]),
    );
    for (const cell of nextBundle.cells) {
      const previousCell = previousCells.get(cell.id);
      if (!previousCell) {
        return null;
      }
      if (previousCell.hash !== cell.hash) {
        if (!changedBundles.includes(key)) {
          changedBundles.push(key);
        }
        updates.push({ bundleKey: key, cell });
      }
    }
  }

  if (updates.length === 0) {
    return {
      type: "patch",
      updates: [],
      changedBundles: [],
      styles: stylePatch,
    };
  }
  return {
    type: "patch",
    updates,
    changedBundles,
    styles: stylePatch,
  };
}

function hasReloadOnlyResourceChanges(
  previous: BuildResult,
  next: BuildResult,
  options: HmrPatchOptions,
): boolean {
  const collect = (build: BuildResult) =>
    new Map(
      build.manifest.emittedFiles
        .filter(
          (file) =>
            file.type !== "style" &&
            file.type !== "source-map" &&
            !(options.ignoreManifestResources && file.type === "manifest"),
        )
        .map((file) => [file.fileName, file.contentHash]),
    );
  const left = collect(previous);
  const right = collect(next);
  if (
    !sameStrings(
      Array.from(left.keys()).sort(),
      Array.from(right.keys()).sort(),
    )
  ) {
    return true;
  }
  return Array.from(right).some(
    ([fileName, hash]) => left.get(fileName) !== hash,
  );
}

export function acceptWebSocket(
  request: http.IncomingMessage,
  socket: Socket,
  clients: Set<Client>,
): void {
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );
  const client = { socket };
  clients.add(client);
  socket.on("close", () => clients.delete(client));
  socket.on("error", () => clients.delete(client));
}

export function broadcast(clients: Set<Client>, message: HmrMessage): void {
  const payload = JSON.stringify(message);
  const frame = encodeWebSocketText(payload);
  for (const client of clients) {
    client.socket.write(frame);
  }
}

function encodeWebSocketText(payload: string): Buffer {
  const body = Buffer.from(payload);
  if (body.length < 126) {
    return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  }
  if (body.length < 65536) {
    const header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.allocUnsafe(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([header, body]);
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}

function createStylePatch(
  previous: BuildResult,
  next: BuildResult,
): string[] | null {
  const previousStyles = collectStyleAssets(previous);
  const nextStyles = collectStyleAssets(next);
  if (
    !sameStrings(
      Array.from(previousStyles.keys()).sort(),
      Array.from(nextStyles.keys()).sort(),
    )
  ) {
    return null;
  }
  return Array.from(nextStyles.entries())
    .filter(([key, nextFile]) => previousStyles.get(key) !== nextFile)
    .map(
      ([key, fileName]) =>
        `/assets/${fileName}?hmr=${encodeURIComponent(fileName)}&key=${encodeURIComponent(key)}`,
    );
}

function collectStyleAssets(build: BuildResult): Map<string, string> {
  return new Map(
    (build.manifest.assets ?? [])
      .filter((asset) => asset.type === "style")
      .map((asset) => [asset.bundleKey ?? asset.fileName, asset.fileName]),
  );
}

function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function commonRoot(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }
  const [first, ...rest] = paths.map((item) => item.split(path.sep));
  let end = first.length;
  for (const parts of rest) {
    while (
      end > 0 &&
      parts.slice(0, end).join(path.sep) !== first.slice(0, end).join(path.sep)
    ) {
      end -= 1;
    }
  }
  return first.slice(0, end).join(path.sep) || path.sep;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
