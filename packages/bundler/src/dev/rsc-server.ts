import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Socket } from "node:net";
import { buildProject, type BuildResult } from "../builder.js";
import type { BundlerConfig } from "../config.js";
import { resolveDevOptions } from "./options.js";
import {
  acceptWebSocket,
  broadcast,
  createPatch,
  watchProject,
  type Client,
  type DevServer,
} from "./server.js";
import type { HmrMessage } from "./server.js";

export type RscDevBundle = {
  envId: string;
  entryId: string;
  fileName: string;
};

export type RscDevRenderContext = {
  build: BuildResult;
  request: http.IncomingMessage;
  response: http.ServerResponse;
  url: URL;
  clientBundle?: RscDevBundle;
  serverBundle?: RscDevBundle;
  readAsset: (fileName: string) => Promise<Buffer>;
  loadServerModule: () => Promise<Record<string, unknown>>;
};

export type RscDevServerOptions = {
  config: BundlerConfig;
  serverEntryId: string;
  clientEntryId: string;
  disposeServerModule?: (
    module: Record<string, unknown>,
  ) => Promise<void> | void;
  render: (context: RscDevRenderContext) => Promise<void> | void;
};

export type RscDevChangeAction =
  | { type: "patch"; patch: Extract<HmrMessage, { type: "patch" }> }
  | { type: "reload"; reason: string }
  | { type: "noop" };

type LoadedServerModule = {
  version: number;
  module: Record<string, unknown>;
};

export async function startRscDevServer(
  options: RscDevServerOptions,
): Promise<DevServer> {
  const devConfig: BundlerConfig = {
    ...options.config,
    dev: {
      hmr: true,
      reactRefresh: true,
      fullReloadOnFailure: true,
      ...(options.config.dev ?? {}),
      port: Number(process.env.PORT ?? options.config.dev?.port ?? 3200),
    },
  };
  const devOptions = await resolveDevOptions(devConfig, devConfig.entries);
  let current = await buildProject(devConfig, []);
  let serverImportVersion = Date.now();
  let clientPatchVersion = 0;
  let loadedServerModule: LoadedServerModule | undefined;
  let pendingServerModule:
    | { version: number; promise: Promise<Record<string, unknown>> }
    | undefined;
  const clients = new Set<Client>();

  const server = http.createServer((request, response) => {
    void handleRscDevRequest(
      options,
      devConfig,
      current,
      () =>
        loadServerModule({
          config: devConfig,
          build: current,
          options,
          version: serverImportVersion,
          loaded: loadedServerModule,
          pending: pendingServerModule,
          setLoaded(nextLoaded) {
            loadedServerModule = nextLoaded;
          },
          setPending(nextPending) {
            pendingServerModule = nextPending;
          },
        }),
      request,
      response,
    );
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
      const action = classifyRscDevChange({
        previous: current,
        next,
        patch,
        clientEntryId: options.clientEntryId,
        serverEntryId: options.serverEntryId,
      });
      if (action.type === "reload") {
        await disposeLoadedServerModule(loadedServerModule, options);
        loadedServerModule = undefined;
        pendingServerModule = undefined;
        serverImportVersion = Date.now();
      }
      current = next;
      if (action.type === "patch") {
        broadcast(
          clients,
          addClientPatchImports(
            action.patch,
            next,
            options.clientEntryId,
            ++clientPatchVersion,
          ),
        );
      } else if (action.type === "reload") {
        broadcast(clients, { type: "rsc-refresh" });
      }
    } catch (error) {
      console.error("[bundler] RSC dev rebuild failed", error);
      broadcast(clients, {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
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
      await disposeLoadedServerModule(loadedServerModule, options);
      for (const client of clients) {
        client.socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function handleRscDevRequest(
  options: RscDevServerOptions,
  config: BundlerConfig,
  build: BuildResult,
  loadServerModuleForVersion: () => Promise<Record<string, unknown>>,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const assetName = matchAssetRequest(url.pathname);
  if (assetName) {
    await serveAsset(config, build, assetName, response);
    return;
  }

  const clientBundle = findBundle(build, options.clientEntryId);
  const serverBundle = findBundle(build, options.serverEntryId);
  const readAsset = (fileName: string) =>
    fsp.readFile(path.join(config.outputs.outDir, path.basename(fileName)));

  try {
    await options.render({
      build,
      request,
      response,
      url,
      clientBundle,
      serverBundle,
      readAsset,
      loadServerModule: loadServerModuleForVersion,
    });
  } catch (error) {
    console.error("[bundler] RSC dev request failed", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "text/plain; charset=utf-8");
    }
    response.end(error instanceof Error ? error.message : String(error));
  }
}

export function classifyRscDevChange({
  previous,
  next,
  patch,
  clientEntryId,
}: {
  previous: BuildResult;
  next: BuildResult;
  patch: Extract<HmrMessage, { type: "patch" }> | null;
  clientEntryId: string;
  serverEntryId: string;
}): RscDevChangeAction {
  if (!patch) {
    return { type: "reload", reason: "not-patchable" };
  }
  const clientBundle = findBundle(next, clientEntryId);
  if (!clientBundle) {
    return { type: "reload", reason: "missing-client-bundle" };
  }
  const clientEnv = clientBundle.envId;
  const patchedBundleKeys = new Set(patch.changedBundles);
  const outputChangedKeys = collectChangedOutputKeys(previous, next);
  if (patch.changedBundles.length === 0) {
    if (outputChangedKeys.length > 0) {
      return {
        type: "reload",
        reason: "bundle-output-changed-without-patch",
      };
    }
    return { type: "noop" };
  }
  if (!patch.changedBundles.every((key) => key.startsWith(`${clientEnv}:`))) {
    return { type: "reload", reason: "non-client-bundle-changed" };
  }

  const outputOnlyChanges = outputChangedKeys.filter(
    (key) => !patchedBundleKeys.has(key),
  );
  if (outputOnlyChanges.some((key) => !key.startsWith(`${clientEnv}:`))) {
    return { type: "reload", reason: "bundle-output-changed-without-patch" };
  }

  return { type: "patch", patch };
}

export function addClientPatchImports(
  patch: Extract<HmrMessage, { type: "patch" }>,
  build: BuildResult,
  clientEntryId: string,
  version?: number,
): Extract<HmrMessage, { type: "patch" }> {
  const importedBundles = patch.changedBundles
    .map((key) =>
      build.manifest.bundles.find(
        (bundle) => `${bundle.envId}:${bundle.entryId}` === key,
      ),
    )
    .filter((bundle): bundle is NonNullable<typeof bundle> => {
      if (!bundle) {
        return false;
      }
      return (
        bundle.entryId !== clientEntryId &&
        !bundle.entryId.endsWith(clientEntryId) &&
        !entryBasenameMatches(bundle.entryId, clientEntryId)
      );
    });
  const imports = importedBundles.map(
    (bundle) =>
      `/assets/${bundle.fileName}?hmr=${encodeURIComponent(bundle.fileName)}&rsc-id=${encodeURIComponent(bundle.entryId)}${version == null ? "" : `&v=${encodeURIComponent(String(version))}`}`,
  );
  const importedBundleKeys = new Set(
    importedBundles.map((bundle) => `${bundle.envId}:${bundle.entryId}`),
  );
  const patchRecords =
    patch.recordBundles && patch.recordBundles.length === patch.records.length
      ? patch.records.filter(
          (_record, index) =>
            !importedBundleKeys.has(patch.recordBundles![index]),
        )
      : patch.records;
  const chunkUpdates = Object.fromEntries(
    importedBundles.map((bundle) => [bundle.entryId, bundle.fileName]),
  );
  const records =
    Object.keys(chunkUpdates).length > 0
      ? [
          ...patchRecords,
          `Object.assign(globalThis.__BUNDLER_RSC_CHUNKS__ ??= {}, ${JSON.stringify(chunkUpdates)});`,
        ]
      : patchRecords;
  if (imports.length === 0 && records === patch.records) {
    return patch;
  }
  return {
    ...patch,
    recordBundles: undefined,
    records,
    imports,
  };
}

function collectChangedOutputKeys(
  previous: BuildResult,
  next: BuildResult,
): string[] {
  const previousOutputs = new Map(
    previous.bundles.map((bundle) => [
      `${bundle.envId}:${bundle.entryId}`,
      bundle.fileName,
    ]),
  );
  const nextOutputs = new Map(
    next.bundles.map((bundle) => [
      `${bundle.envId}:${bundle.entryId}`,
      bundle.fileName,
    ]),
  );
  if (
    !sameStrings(
      Array.from(previousOutputs.keys()).sort(),
      Array.from(nextOutputs.keys()).sort(),
    )
  ) {
    return ["<bundle-set>"];
  }
  return Array.from(nextOutputs.entries())
    .filter(([key, fileName]) => previousOutputs.get(key) !== fileName)
    .map(([key]) => key);
}

async function loadServerModule({
  config,
  build,
  options,
  version,
  loaded,
  pending,
  setLoaded,
  setPending,
}: {
  config: BundlerConfig;
  build: BuildResult;
  options: RscDevServerOptions;
  version: number;
  loaded: LoadedServerModule | undefined;
  pending:
    | { version: number; promise: Promise<Record<string, unknown>> }
    | undefined;
  setLoaded: (loaded: LoadedServerModule | undefined) => void;
  setPending: (
    pending:
      | { version: number; promise: Promise<Record<string, unknown>> }
      | undefined,
  ) => void;
}): Promise<Record<string, unknown>> {
  if (loaded?.version === version) {
    return loaded.module;
  }
  if (pending?.version === version) {
    return pending.promise;
  }
  const serverBundle = findBundle(build, options.serverEntryId);
  if (!serverBundle) {
    throw new Error(`Missing RSC server bundle '${options.serverEntryId}'.`);
  }
  const href = pathToFileURL(
    path.join(config.outputs.outDir, serverBundle.fileName),
  ).href;
  (globalThis as { __BUNDLER_RSC_DEV__?: boolean }).__BUNDLER_RSC_DEV__ = true;
  const promise = import(`${href}?t=${version}`) as Promise<
    Record<string, unknown>
  >;
  setPending({ version, promise });
  try {
    const module = await promise;
    setLoaded({ version, module });
    return module;
  } finally {
    setPending(undefined);
  }
}

async function disposeLoadedServerModule(
  loaded: LoadedServerModule | undefined,
  options: RscDevServerOptions,
): Promise<void> {
  if (!loaded) {
    return;
  }
  try {
    if (options.disposeServerModule) {
      await options.disposeServerModule(loaded.module);
      return;
    }
    const disposer =
      loaded.module.disposeServerModule ??
      loaded.module.disposeServer ??
      loaded.module.dispose;
    if (typeof disposer === "function") {
      await disposer();
    }
  } catch (error) {
    console.error("[bundler] RSC dev server module dispose failed", error);
  }
}

async function serveAsset(
  config: BundlerConfig,
  build: BuildResult,
  fileName: string,
  response: http.ServerResponse,
): Promise<void> {
  const bundle = build.bundles.find((item) => item.fileName === fileName);
  const asset = build.manifest.assets?.find(
    (item) => item.fileName === fileName,
  );
  if (!bundle && !asset) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader(
    "content-type",
    asset?.contentType ?? "text/javascript; charset=utf-8",
  );
  response.end(
    await fsp.readFile(
      path.join(config.outputs.outDir, asset?.fileName ?? fileName),
    ),
  );
}

function matchAssetRequest(pathname: string): string | null {
  if (pathname.startsWith("/assets/")) {
    return path.basename(pathname);
  }
  if (pathname.endsWith(".js")) {
    return path.basename(pathname);
  }
  return null;
}

function findBundle(
  build: BuildResult,
  entryId: string,
): RscDevBundle | undefined {
  return build.bundles.find(
    (bundle) =>
      bundle.entryId === entryId ||
      bundle.entryId.endsWith(entryId) ||
      entryBasenameMatches(bundle.entryId, entryId),
  );
}

function entryBasenameMatches(actualEntryId: string, expectedEntryId: string) {
  const basename = path.basename(actualEntryId);
  return (
    basename === expectedEntryId || basename.startsWith(`${expectedEntryId}.`)
  );
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}
