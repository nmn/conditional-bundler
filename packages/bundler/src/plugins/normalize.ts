import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  contentHash,
  findPkgRoot,
  packagePathIdentity,
  readPkgSafe,
} from "@bundler/shared";
import type {
  BabelPluginSpec,
  BundlerPlugin,
  EnvValue,
  InlineBundlerPlugin,
  ModuleBundlerPlugin,
  NormalizedBabelPluginSpec,
  NormalizedPlugin,
  NormalizedRepresentationHandler,
  NormalizedScopedBabelPluginSpec,
  RepresentationHandler,
  ScopedBabelPluginSpec,
  WorkerTransformProfile,
} from "./types.js";

const requireFromHere = createRequire(import.meta.url);

export function plugin(
  moduleSpecifier: string,
  options?: Record<string, unknown>,
): ModuleBundlerPlugin {
  return {
    __bundlerPluginRef: true,
    module: moduleSpecifier,
    options,
  };
}

export function getEnvValue<T>(
  value: EnvValue<T> | undefined,
  envId: string,
): T | undefined {
  if (value == null) {
    return undefined;
  }
  if (!isEnvMap(value)) {
    return value;
  }
  if (envId in value) {
    return value[envId];
  }
  return value.default;
}

export function getEnvListValue<T>(
  value: EnvValue<T[]> | undefined,
  envId: string,
): T[] {
  if (value == null) {
    return [];
  }
  if (!isEnvMap(value)) {
    return value;
  }
  if (envId === "default") {
    return [...(value.default ?? [])];
  }
  return [...(value.default ?? []), ...(value[envId] ?? [])];
}

export async function normalizePlugins(plugins: BundlerPlugin[]): Promise<{
  plugins: NormalizedPlugin[];
  workerProfile: WorkerTransformProfile;
}> {
  const normalized: NormalizedPlugin[] = [];

  for (const plugin of plugins) {
    if (isModulePlugin(plugin)) {
      normalized.push(await loadModulePlugin(plugin));
      continue;
    }
    validateInlinePlugin(plugin);
    normalized.push({
      name: plugin.name,
      buildStart: plugin.buildStart,
      resolveImport: plugin.resolveImport,
      transformDocument: plugin.transformDocument,
      beforeCombine: plugin.beforeCombine,
      afterCombine: plugin.afterCombine,
      buildEnd: plugin.buildEnd,
      planBundleResources: plugin.planBundleResources,
      generateBundleResources: plugin.generateBundleResources,
      manualChunk: plugin.manualChunk,
    });
  }

  resolveRepresentationInheritance(normalized);

  return {
    plugins: normalized,
    workerProfile: buildWorkerTransformProfile(normalized),
  };
}

function isEnvMap<T>(
  value: EnvValue<T>,
): value is { default?: T } & Record<string, T | undefined> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function isModulePlugin(plugin: BundlerPlugin): plugin is ModuleBundlerPlugin {
  return "__bundlerPluginRef" in plugin && plugin.__bundlerPluginRef === true;
}

function validateInlinePlugin(plugin: InlineBundlerPlugin): void {
  if ("load" in plugin) {
    throw new Error(
      `Plugin '${plugin.name}' declares the removed 'load' hook. Resolver plugins may only return existing regular files or { preserve: true }.`,
    );
  }
  if (
    plugin.transform ||
    plugin.transformPre ||
    plugin.transformFinalize ||
    plugin.transformPost
  ) {
    throw new Error(
      `Inline plugin '${plugin.name}' cannot declare worker-phase hooks. Use plugin(moduleSpecifier, options) instead.`,
    );
  }
  if (plugin.representations) {
    throw new Error(
      `Inline plugin '${plugin.name}' cannot declare representation handlers. Use plugin(moduleSpecifier, options) so handler identity and worker code can be fingerprinted.`,
    );
  }
}

async function loadModulePlugin(
  pluginRef: ModuleBundlerPlugin,
): Promise<NormalizedPlugin> {
  const modulePath = resolveModuleSpecifier(pluginRef.module, process.cwd());
  const imported = await import(pathToFileURL(modulePath).href);
  const factory = imported.default ?? imported.plugin ?? imported;
  const plugin =
    typeof factory === "function"
      ? await factory(pluginRef.options ?? {})
      : factory;

  if (!plugin || typeof plugin !== "object") {
    throw new Error(
      `Plugin module '${pluginRef.module}' did not export a plugin object.`,
    );
  }
  if (!plugin.name) {
    throw new Error(
      `Plugin module '${pluginRef.module}' is missing a plugin name.`,
    );
  }
  if ("load" in plugin) {
    throw new Error(
      `Plugin '${plugin.name}' declares the removed 'load' hook. Resolver plugins may only return existing regular files or { preserve: true }.`,
    );
  }

  const resolved: NormalizedPlugin = {
    ...plugin,
    modulePath,
  };

  if (plugin.representations) {
    resolved.representations = Object.fromEntries(
      Object.entries(
        plugin.representations as Record<string, RepresentationHandler>,
      ).map(([representation, handler]) => {
        if (
          !handler ||
          (typeof handler.resolve !== "function" &&
            typeof handler.extends !== "string")
        ) {
          throw new Error(
            `Representation '${representation}' in plugin '${plugin.name}' must declare resolve() or extends.`,
          );
        }
        const workerTransform = handler.workerTransform
          ? resolveBabelSpec(handler.workerTransform, modulePath)
          : undefined;
        return [
          representation,
          {
            resolve: handler.resolve,
            extends: handler.extends,
            workerTransform,
            identity: `${plugin.name}::as=${representation}`,
            owner: plugin.name,
          },
        ];
      }),
    );
  }

  if (plugin.transformPre) {
    resolved.transformPre = resolveScopedBabelSpecs(
      plugin.transformPre,
      modulePath,
    );
  }
  if (plugin.transform) {
    resolved.transform = resolveScopedBabelSpecs(plugin.transform, modulePath);
  }
  if (plugin.transformFinalize) {
    resolved.transformFinalize = resolveScopedBabelSpecs(
      plugin.transformFinalize,
      modulePath,
    );
  }
  if (plugin.transformPost) {
    resolved.transformPost = resolveScopedBabelSpecs(
      plugin.transformPost,
      modulePath,
    );
  }

  const pkgRoot = findPkgRoot(modulePath) ?? path.dirname(modulePath);
  const pkg = readPkgSafe(pkgRoot);
  resolved.workerFingerprint = contentHash(
    JSON.stringify({
      name: plugin.name,
      modulePath: portablePathIdentity(modulePath),
      moduleHash: hashFileIfExists(modulePath),
      version: pkg.version,
      options: portableFingerprintValue(pluginRef.options ?? null),
      transform: portableScopedSpecs(resolved.transform),
      transformPre: portableScopedSpecs(resolved.transformPre),
      transformFinalize: portableScopedSpecs(resolved.transformFinalize),
      transformPost: portableScopedSpecs(resolved.transformPost),
      transformFiles: hashTransformFiles([
        resolved.transform,
        resolved.transformPre,
        resolved.transformFinalize,
        resolved.transformPost,
      ]),
      representations: Object.fromEntries(
        Object.entries(resolved.representations ?? {}).map(
          ([representation, handler]) => [
            representation,
            {
              identity: handler.identity,
              extends: handler.extends,
              workerTransform: handler.workerTransform
                ? {
                    ...portableBabelSpec(handler.workerTransform),
                    moduleHash: hashFileIfExists(
                      handler.workerTransform.modulePath,
                    ),
                  }
                : null,
            },
          ],
        ),
      ),
    }),
  );
  return resolved;
}

function resolveRepresentationInheritance(plugins: NormalizedPlugin[]): void {
  const handlers = new Map<
    string,
    { plugin: NormalizedPlugin; handler: NormalizedRepresentationHandler }
  >();
  for (const plugin of plugins) {
    for (const [name, handler] of Object.entries(
      plugin.representations ?? {},
    )) {
      if (handlers.has(name)) {
        throw new Error(`Representation '${name}' is declared more than once.`);
      }
      handlers.set(name, { plugin, handler });
    }
  }

  const resolved = new Set<string>();
  const active = new Set<string>();
  const visit = (name: string): NormalizedRepresentationHandler => {
    const entry = handlers.get(name);
    if (!entry) {
      throw new Error(`Unknown parent representation '${name}'.`);
    }
    if (resolved.has(name)) return entry.handler;
    if (active.has(name)) {
      throw new Error(`Cyclic representation inheritance at '${name}'.`);
    }
    active.add(name);
    const parentName = entry.handler.extends;
    if (parentName) {
      const parent = visit(parentName);
      if (!entry.handler.resolve) {
        entry.handler.resolve = parent.resolve;
        entry.handler.resolveAs = parent.resolveAs ?? parentName;
      }
      entry.handler.workerTransform ??= parent.workerTransform;
    }
    if (!entry.handler.resolve) {
      throw new Error(
        `Representation '${name}' does not inherit or declare resolve().`,
      );
    }
    active.delete(name);
    resolved.add(name);
    return entry.handler;
  };
  for (const name of handlers.keys()) visit(name);
}

function hashTransformFiles(
  values: Array<NormalizedScopedBabelPluginSpec[] | undefined>,
): Record<string, string | null> {
  const modulePaths = new Set<string>();
  for (const value of values) {
    for (const entry of value ?? []) {
      modulePaths.add(entry.plugin.modulePath);
    }
  }
  return Object.fromEntries(
    Array.from(modulePaths)
      .sort()
      .map((modulePath) => [
        portablePathIdentity(modulePath),
        hashFileIfExists(modulePath),
      ]),
  );
}

function hashFileIfExists(filePath: string): string | null {
  try {
    return contentHash(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveScopedBabelSpecs(
  value:
    | ScopedBabelPluginSpec[]
    | ({ default?: BabelPluginSpec[] } & Record<
        string,
        BabelPluginSpec[] | undefined
      >),
  fromModulePath: string,
): NormalizedScopedBabelPluginSpec[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (isScopedBabelSpec(entry)) {
        return {
          plugin: resolveBabelSpec(entry.plugin, fromModulePath),
          environments: entry.environments,
          targets: entry.targets,
        };
      }
      return { plugin: resolveBabelSpec(entry, fromModulePath) };
    });
  }

  // Compatibility for the previous EnvValue transform shape: `default`
  // becomes the shared stage and named keys become explicit env stages.
  const resolved: NormalizedScopedBabelPluginSpec[] = [];
  for (const entry of value.default ?? []) {
    resolved.push({ plugin: resolveBabelSpec(entry, fromModulePath) });
  }
  for (const [envId, entries] of Object.entries(value)) {
    if (envId === "default" || !entries) {
      continue;
    }
    for (const entry of entries) {
      resolved.push({
        plugin: resolveBabelSpec(entry, fromModulePath),
        environments: [envId],
      });
    }
  }
  return resolved;
}

function isScopedBabelSpec(
  value: ScopedBabelPluginSpec,
): value is Extract<ScopedBabelPluginSpec, { plugin: BabelPluginSpec }> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "plugin" in value
  );
}

function resolveBabelSpec(
  spec: BabelPluginSpec,
  fromModulePath: string,
): NormalizedBabelPluginSpec {
  if (Array.isArray(spec)) {
    return {
      modulePath: resolveModuleSpecifier(spec[0], path.dirname(fromModulePath)),
      options: spec[1],
    };
  }
  return {
    modulePath: resolveModuleSpecifier(spec, path.dirname(fromModulePath)),
  };
}

function resolveModuleSpecifier(specifier: string, fromDir: string): string {
  if (path.isAbsolute(specifier)) {
    return specifier;
  }
  if (specifier.startsWith(".")) {
    return path.resolve(fromDir, specifier);
  }
  return requireFromHere.resolve(specifier, { paths: [fromDir] });
}

function buildWorkerTransformProfile(
  plugins: NormalizedPlugin[],
): WorkerTransformProfile {
  const transformPre: NormalizedScopedBabelPluginSpec[] = [];
  const transform: NormalizedScopedBabelPluginSpec[] = [];
  const transformFinalize: NormalizedScopedBabelPluginSpec[] = [];
  const transformPost: NormalizedScopedBabelPluginSpec[] = [];
  const representationTransforms: Record<string, NormalizedBabelPluginSpec> =
    {};

  for (const plugin of plugins) {
    transform.push(...(plugin.transform ?? []));
    transformPre.push(...(plugin.transformPre ?? []));
    transformFinalize.push(...(plugin.transformFinalize ?? []));
    transformPost.push(...(plugin.transformPost ?? []));
    for (const handler of Object.values(plugin.representations ?? {})) {
      if (!handler.workerTransform) continue;
      representationTransforms[handler.identity] = handler.workerTransform;
    }
  }

  const profile = {
    fingerprint: contentHash(
      JSON.stringify({
        transform: portableScopedSpecs(transform),
        transformPre: portableScopedSpecs(transformPre),
        transformFinalize: portableScopedSpecs(transformFinalize),
        transformPost: portableScopedSpecs(transformPost),
        representationTransforms: Object.fromEntries(
          Object.entries(representationTransforms)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([identity, spec]) => [identity, portableBabelSpec(spec)]),
        ),
        plugins: plugins
          .map((plugin) => plugin.workerFingerprint)
          .filter((value): value is string => Boolean(value)),
        coreToolchain: coreWorkerToolchainFingerprint(),
      }),
    ),
    transform,
    transformPre,
    transformFinalize,
    transformPost,
    representationTransforms,
  };
  return profile;
}

function portableBabelSpec(value: NormalizedBabelPluginSpec): {
  modulePath: string;
  options: unknown;
} {
  return {
    modulePath: portablePathIdentity(value.modulePath),
    options: portableFingerprintValue(value.options),
  };
}

let cachedCoreWorkerToolchainFingerprint: string | undefined;

function coreWorkerToolchainFingerprint(): string {
  if (cachedCoreWorkerToolchainFingerprint) {
    return cachedCoreWorkerToolchainFingerprint;
  }
  const workerEntry = requireFromHere.resolve("@bundler/worker/worker");
  const workerRoot = findPkgRoot(workerEntry) ?? path.dirname(workerEntry);
  const workerRequire = createRequire(pathToFileURL(workerEntry));
  const dependencyVersions = Object.fromEntries(
    [
      "@ampproject/remapping",
      "@babel/core",
      "@babel/generator",
      "@babel/parser",
      "@babel/traverse",
      "@babel/types",
      "image-size",
      "lightningcss",
    ].map((specifier) => {
      const resolved = workerRequire.resolve(specifier);
      const root = findPkgRoot(resolved) ?? path.dirname(resolved);
      return [specifier, readPkgSafe(root).version];
    }),
  );
  const distDir = path.join(workerRoot, "dist");
  const implementation = collectFingerprintFiles(distDir).map((filePath) => [
    normalizePortableRelativePath(path.relative(distDir, filePath)),
    hashFileIfExists(filePath),
  ]);
  cachedCoreWorkerToolchainFingerprint = contentHash(
    JSON.stringify({
      workerVersion: readPkgSafe(workerRoot).version,
      dependencyVersions,
      implementation,
    }),
  );
  return cachedCoreWorkerToolchainFingerprint;
}

function collectFingerprintFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFingerprintFiles(filePath);
      return entry.isFile() && /\.(?:c?js|json)$/.test(entry.name)
        ? [filePath]
        : [];
    })
    .sort();
}

function normalizePortableRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function portableScopedSpecs(
  value: NormalizedScopedBabelPluginSpec[] | undefined,
): unknown[] | null {
  return value
    ? value.map((entry) => ({
        modulePath: portablePathIdentity(entry.plugin.modulePath),
        options: portableFingerprintValue(entry.plugin.options),
        environments: entry.environments,
        targets: entry.targets,
      }))
    : null;
}

function portableFingerprintValue(value: unknown): unknown {
  if (typeof value === "string" && path.isAbsolute(value)) {
    return portablePathIdentity(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => portableFingerprintValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, portableFingerprintValue(item)]),
    );
  }
  return value;
}

function portablePathIdentity(filePath: string): string {
  const pkgRoot = findPkgRoot(filePath);
  if (!pkgRoot) {
    return `unpackaged::${path.basename(filePath) || "."}`;
  }
  return packagePathIdentity(readPkgSafe(pkgRoot), filePath);
}
