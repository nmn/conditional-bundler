import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import { buildProject, type BuildResult } from "../builder.js";
import type { BundlerConfig } from "../config.js";
import type { HmrBundleRecord } from "./hmr-linker.js";
import { resolveDevOptions } from "./options.js";
import { readDevAsset, resolveConditionalPatch } from "./conditional-assets.js";

export type DevServer = {
  url: string;
  close: () => Promise<void>;
};

type HmrMetadata = {
  bundles?: Record<string, HmrBundleRecord>;
};

export type HmrMessage =
  | {
      type: "patch";
      records: string[];
      recordBundles?: string[];
      changedBundles: string[];
      imports?: string[];
      styles?: string[];
    }
  | { type: "rsc-refresh" }
  | { type: "reload" }
  | { type: "error"; message: string };

export type Client = {
  socket: Socket;
};

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
  const server = http.createServer((request, response) => {
    void handleRequest(devConfig, current, request, response);
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
      const patch = createPatch(current, next);
      current = next;
      broadcast(
        clients,
        patch ? await resolveConditionalPatch(patch) : { type: "reload" },
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
      for (const client of clients) {
        client.socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function handleRequest(
  config: BundlerConfig,
  build: BuildResult,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(renderIndex(build));
    return;
  }

  const served = await readDevAsset(config, build, path.basename(url.pathname));
  if (!served) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader("content-type", served.contentType);
  response.end(served.body);
}

function renderIndex(build: BuildResult): string {
  const styles = (build.manifest.assets ?? [])
    .filter((asset) => asset.type === "style")
    .map(
      (asset) =>
        `<link rel="stylesheet" href="/assets/${escapeHtml(asset.fileName)}" data-bundler-style="${escapeHtml(asset.bundleKey ?? asset.fileName)}">`,
    )
    .join("\n");
  const scripts = build.bundles
    .filter((bundle) => bundle.envId && bundle.entryId)
    .map(
      (bundle) =>
        `<script type="module" src="/${escapeHtml(bundle.fileName)}"></script>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>conditional-bundler dev</title>${styles}</head>
  <body>${scripts}</body>
</html>`;
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

  let timer: NodeJS.Timeout | undefined;
  return fs.watch(root, { recursive: true }, () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => void onChange(), 50);
  });
}

export function createPatch(
  previous: BuildResult,
  next: BuildResult,
): Extract<HmrMessage, { type: "patch" }> | null {
  const previousHmr = previous.manifest.metadata.hmr as HmrMetadata | undefined;
  const nextHmr = next.manifest.metadata.hmr as HmrMetadata | undefined;
  if (!previousHmr?.bundles || !nextHmr?.bundles) {
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

  const records: string[] = [];
  const recordBundles: string[] = [];
  const changedBundles: string[] = [];
  for (const [key, nextBundle] of Object.entries(nextHmr.bundles)) {
    const previousBundle = previousHmr.bundles[key];
    if (!previousBundle) {
      return null;
    }
    if (!sameStrings(previousBundle.symbols, nextBundle.symbols)) {
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
        records.push(cell.patchCode ?? cell.code);
        recordBundles.push(key);
      }
    }
  }

  if (records.length === 0) {
    return {
      type: "patch",
      records: [],
      changedBundles: [],
      styles: stylePatch,
    };
  }
  return {
    type: "patch",
    records,
    recordBundles,
    changedBundles,
    styles: stylePatch,
  };
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
