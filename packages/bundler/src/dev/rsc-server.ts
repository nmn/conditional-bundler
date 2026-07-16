import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Socket } from "node:net";
import { buildProject, type BuildResult } from "../builder.js";
import type { BundlerConfig } from "../config.js";
import { resolveDevOptions } from "./options.js";
import { readDevAsset } from "./conditional-assets.js";
import {
  acceptWebSocket,
  broadcast,
  createPatch,
  hmrUpdatePrefix,
  HmrUpdateStore,
  watchProject,
  type Client,
  type DevServer,
  type HmrPatchPlan,
} from "./server.js";

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
  | { type: "patch"; patch: HmrPatchPlan }
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
  const hmrUpdates = new HmrUpdateStore();

  const server = http.createServer((request, response) => {
    void handleRscDevRequest(
      options,
      devConfig,
      current,
      hmrUpdates,
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
      const patch = createPatch(current, next, {
        ignoreManifestResources: true,
      });
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
        const patchWithImports = addClientPatchImports(
          action.patch,
          next,
          options.clientEntryId,
          ++clientPatchVersion,
        );
        broadcast(clients, await hmrUpdates.publish(patchWithImports));
      } else if (action.type === "reload") {
        broadcast(clients, {
          type: "rsc-refresh",
          styles: patch?.styles,
        });
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
      hmrUpdates.clear();
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
  hmrUpdates: HmrUpdateStore,
  loadServerModuleForVersion: () => Promise<Record<string, unknown>>,
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
  for (const assetName of matchAssetRequests(url.pathname)) {
    const served = await readDevAsset(config, build, assetName);
    if (served) {
      response.setHeader("content-type", served.contentType);
      response.end(served.body);
      return;
    }
  }

  const clientBundle = findBundle(build, options.clientEntryId);
  const serverBundle = findBundle(build, options.serverEntryId);
  const readAsset = (fileName: string) => {
    const root = path.resolve(config.outputs.outDir);
    const candidate = path.resolve(root, fileName);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Refusing to read output outside '${root}'.`);
    }
    return fsp.readFile(candidate);
  };

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
  patch: HmrPatchPlan | null;
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
    if ((patch.styles?.length ?? 0) > 0) {
      return { type: "patch", patch };
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
  patch: HmrPatchPlan,
  build: BuildResult,
  clientEntryId: string,
  version?: number,
): HmrPatchPlan {
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
  const updates = patch.updates.filter(
    (update) => !importedBundleKeys.has(update.bundleKey),
  );
  const chunkUpdates = Object.fromEntries(
    importedBundles.map((bundle) => [bundle.entryId, bundle.fileName]),
  );
  if (imports.length === 0) {
    return patch;
  }
  return {
    ...patch,
    updates,
    imports,
    rscChunks: chunkUpdates,
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

function matchAssetRequests(pathname: string): string[] {
  const requested = decodeURIComponent(pathname.replace(/^\/+/, ""));
  if (
    !requested ||
    requested.startsWith("/") ||
    requested.includes("\\") ||
    requested.split("/").includes("..")
  ) {
    return [];
  }
  return requested.startsWith("assets/")
    ? [requested, requested.slice("assets/".length)]
    : [requested];
}

function findBundle(
  build: BuildResult,
  entryId: string,
): RscDevBundle | undefined {
  const direct = build.bundles.find(
    (bundle) =>
      bundle.entryId === entryId ||
      bundle.entryId.endsWith(`${path.sep}${entryId}`) ||
      entryBasenameMatches(bundle.entryId, entryId),
  );
  if (direct) {
    return direct;
  }
  return build.bundles.find(
    (bundle) =>
      bundle.envId === entryId &&
      path.basename(bundle.entryId) === "runtime-client.js",
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
