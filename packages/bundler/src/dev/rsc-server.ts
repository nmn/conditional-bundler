import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Socket } from "node:net";
import { buildProject, type BuildResult } from "../builder.js";
import { parseBuildScopeId, type BundlerConfig } from "../config.js";
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
  id: string;
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
      await syncChangedRscNodeModules(
        devConfig,
        current,
        next,
        clientPatchVersion + 1,
      );
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
          devConfig.outputs.rootURL,
        );
        broadcast(clients, await hmrUpdates.publish(patchWithImports));
      } else if (action.type === "reload") {
        const patchWithImports = patch
          ? addClientPatchImports(
              patch,
              next,
              options.clientEntryId,
              ++clientPatchVersion,
              devConfig.outputs.rootURL,
            )
          : undefined;
        const hasClientCode =
          (patchWithImports?.updates.length ?? 0) > 0 ||
          (patchWithImports?.imports?.length ?? 0) > 0;
        const refreshesRsc = (patchWithImports?.rscModules?.length ?? 0) > 0;
        if (patchWithImports && hasClientCode) {
          broadcast(clients, await hmrUpdates.publish(patchWithImports));
        }
        if (!refreshesRsc) {
          broadcast(clients, {
            type: "rsc-refresh",
            styles: hasClientCode ? undefined : patch?.styles,
          });
        }
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
  serverEntryId,
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
  const serverBundle = findBundle(next, serverEntryId);
  if (
    serverBundle &&
    hasChangedServerJavaScriptMetadata(previous, next, serverBundle)
  ) {
    return { type: "reload", reason: "server-transform-metadata-changed" };
  }
  const clientEnv = clientBundle.envId;
  const patchedBundleKeys = new Set(patch.changedBundles);
  const outputChangedKeys = collectChangedOutputKeys(previous, next);
  if (patch.changedBundles.length === 0) {
    if ((patch.styles?.length ?? 0) > 0) {
      return { type: "patch", patch };
    }
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

function hasChangedServerJavaScriptMetadata(
  previous: BuildResult,
  next: BuildResult,
  serverBundle: BuildResult["bundles"][number],
): boolean {
  const before = previous.hmr?.moduleMetadata ?? {};
  const after = next.hmr?.moduleMetadata ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const prior = before[key];
    const current = after[key];
    const record = current ?? prior;
    if (
      !record ||
      record.environmentId !== serverBundle.environmentId ||
      record.targetId !== serverBundle.targetId ||
      !/\.(?:[cm]?js|jsx|tsx?|mts|cts)$/.test(record.filePath)
    ) {
      continue;
    }
    if (!prior || !current || prior.hash !== current.hash) {
      return true;
    }
  }
  return false;
}

export function addClientPatchImports(
  patch: HmrPatchPlan,
  build: BuildResult,
  clientEntryId: string,
  version?: number,
  rootURL = "/",
): HmrPatchPlan {
  const clientBundle = findBundle(build, clientEntryId);
  const importedBundles = patch.changedBundles
    .map((key) => {
      const bundle = findBundleForLogicalKey(build, key);
      const entryId =
        bundle?.entrypoints?.find(
          (entrypoint) => `${entrypoint.envId}:${entrypoint.entryId}` === key,
        )?.entryId ??
        bundle?.entryId ??
        key;
      return bundle ? { bundle, entryId, key } : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => {
      if (!item) {
        return false;
      }
      return (
        item.bundle.id !== clientBundle?.id &&
        item.entryId !== clientEntryId &&
        !item.entryId.endsWith(clientEntryId) &&
        !entryBasenameMatches(item.entryId, clientEntryId)
      );
    });
  const imports = importedBundles.map(({ bundle, entryId }) => {
    const rscIds = findRscClientReferenceIds(build, bundle);
    const cacheIds = rscIds.length > 0 ? rscIds : [entryId];
    const rscIdQuery = cacheIds
      .map((rscId) => `&rsc-id=${encodeURIComponent(rscId)}`)
      .join("");
    return `${joinRootURL(rootURL, bundle.fileName)}?hmr=${encodeURIComponent(bundle.fileName)}${rscIdQuery}${version == null ? "" : `&v=${encodeURIComponent(String(version))}`}`;
  });
  const importedBundleKeys = new Set(importedBundles.map(({ key }) => key));
  const updates = patch.updates.filter(
    (update) => !importedBundleKeys.has(update.bundleKey),
  );
  const rscModules = Array.from(
    new Set(
      importedBundles.flatMap(({ bundle, entryId }) => {
        const rscIds = findRscClientReferenceIds(build, bundle);
        return rscIds.length > 0 ? rscIds : [entryId];
      }),
    ),
  );
  if (imports.length === 0) {
    return patch;
  }
  return {
    ...patch,
    updates,
    imports,
    rscModules,
  };
}

function joinRootURL(rootURL: string, fileName: string): string {
  const root = rootURL.replace(/\/+$/, "");
  const relativePath = fileName.replaceAll("\\", "/").replace(/^\/+/, "");
  return root ? `${root}/${relativePath}` : `/${relativePath}`;
}

function collectChangedOutputKeys(
  previous: BuildResult,
  next: BuildResult,
): string[] {
  const previousOutputs = collectLogicalOutputs(previous);
  const nextOutputs = collectLogicalOutputs(next);
  if (
    !sameStrings(
      Array.from(previousOutputs.keys()).sort(),
      Array.from(nextOutputs.keys()).sort(),
    )
  ) {
    return ["<bundle-set>"];
  }
  return Array.from(nextOutputs.entries())
    .filter(([key, output]) => {
      const prior = previousOutputs.get(key);
      if (!prior) {
        return true;
      }
      if (prior.runtimeHash && output.runtimeHash) {
        return prior.runtimeHash !== output.runtimeHash;
      }
      return prior.fileName !== output.fileName;
    })
    .map(([key]) => key);
}

function collectLogicalOutputs(
  build: BuildResult,
): Map<string, { fileName: string; runtimeHash?: string }> {
  const bundleRuntimeHashes = new Map(
    build.bundles.map((bundle) => [bundle.id, bundle.runtimeHash]),
  );
  const entrypoints = build.entrypoints ?? build.manifest.entrypoints;
  if (entrypoints && Object.keys(entrypoints).length > 0) {
    return new Map(
      Object.entries(entrypoints).map(([key, value]) => [
        key,
        {
          fileName: value.fileName,
          runtimeHash: bundleRuntimeHashes.get(value.bundleId),
        },
      ]),
    );
  }
  return new Map(
    build.bundles.flatMap((bundle) => {
      const aliases = bundle.entrypoints ?? [
        { envId: bundle.envId, entryId: bundle.entryId },
      ];
      return aliases.map(
        (entrypoint) =>
          [
            `${entrypoint.envId}:${entrypoint.entryId}`,
            {
              fileName: bundle.fileName,
              runtimeHash: bundle.runtimeHash,
            },
          ] as const,
      );
    }),
  );
}

export async function syncChangedRscNodeModules(
  config: BundlerConfig,
  previous: BuildResult,
  next: BuildResult,
  version = Date.now(),
): Promise<void> {
  const runtime = globalThis as {
    __BUNDLER_RSC_IMPLEMENTATIONS__?: Map<
      string,
      {
        status: string;
        promise?: Promise<unknown>;
        value?: unknown;
      }
    >;
  };
  const previousOutputs = collectLogicalOutputs(previous);
  const changes = next.bundles.flatMap((bundle) =>
    (
      bundle.entrypoints ?? [
        {
          envId: bundle.envId,
          entryId: bundle.entryId,
          exportMode: bundle.exportMode,
        },
      ]
    )
      .filter(
        (entrypoint) =>
          entrypoint.exportMode === "dynamic" &&
          config.targets[
            entrypoint.targetId ?? parseBuildScopeId(entrypoint.envId).targetId
          ]?.platform === "node",
      )
      .filter((entrypoint) => {
        const previousOutput = previousOutputs.get(
          `${entrypoint.envId}:${entrypoint.entryId}`,
        );
        return (
          previousOutput?.fileName !== bundle.fileName ||
          (previousOutput.runtimeHash != null &&
            bundle.runtimeHash != null &&
            previousOutput.runtimeHash !== bundle.runtimeHash)
        );
      })
      .map((entrypoint) => ({
        entryId: entrypoint.entryId,
        fileName: bundle.fileName,
        rscIds: findRscClientReferenceIds(next, bundle),
      }))
      .filter((change) => change.rscIds.length > 0),
  );
  if (changes.length === 0) {
    return;
  }

  const implementations = (runtime.__BUNDLER_RSC_IMPLEMENTATIONS__ ??=
    new Map());
  for (const [index, change] of changes.entries()) {
    const href = pathToFileURL(
      path.join(config.outputs.outDir, change.fileName),
    ).href;
    const module = await import(
      `${href}?bundler-rsc-hmr=${encodeURIComponent(`${version}-${index}`)}`
    );
    for (const id of change.rscIds) {
      for (const [key, entry] of implementations) {
        if (!key.startsWith(`${id}#`)) continue;
        const exportName = key.slice(id.length + 1);
        entry.status = "fulfilled";
        entry.promise = undefined;
        entry.value =
          exportName === "*"
            ? module
            : exportName === ""
              ? module.default
              : module[exportName];
      }
    }
  }
}

function findRscClientReferenceIds(
  build: BuildResult,
  bundle: BuildResult["bundles"][number],
): string[] {
  const rscMetadata = build.manifest.metadata?.rsc;
  if (
    !rscMetadata ||
    typeof rscMetadata !== "object" ||
    Array.isArray(rscMetadata)
  ) {
    return [];
  }
  const clientReferenceBundles = (
    rscMetadata as {
      clientReferenceBundles?: unknown;
    }
  ).clientReferenceBundles;
  if (
    !clientReferenceBundles ||
    typeof clientReferenceBundles !== "object" ||
    Array.isArray(clientReferenceBundles)
  ) {
    return [];
  }
  return Object.entries(clientReferenceBundles)
    .filter(([, bundleIds]) => {
      if (
        !bundleIds ||
        typeof bundleIds !== "object" ||
        Array.isArray(bundleIds)
      ) {
        return false;
      }
      return Object.values(bundleIds).includes(bundle.id);
    })
    .map(([clientReferenceId]) => clientReferenceId)
    .sort();
}

function findBundleForLogicalKey(
  build: BuildResult,
  key: string,
): BuildResult["bundles"][number] | undefined {
  const logical = build.entrypoints?.[key] ?? build.manifest.entrypoints?.[key];
  if (logical) {
    return build.bundles.find(
      (bundle) =>
        bundle.id === logical.bundleId || bundle.fileName === logical.fileName,
    );
  }
  return build.bundles.find(
    (bundle) =>
      `${bundle.envId}:${bundle.entryId}` === key ||
      bundle.entrypoints?.some(
        (entrypoint) => `${entrypoint.envId}:${entrypoint.entryId}` === key,
      ),
  );
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
): BuildResult["bundles"][number] | undefined {
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
      ((bundle.targetIds ?? []).includes(entryId) ||
        bundle.envId === entryId) &&
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
