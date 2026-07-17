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
  NormalizedScopedBabelPluginSpec,
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
      generateBundleResources: plugin.generateBundleResources,
      manualChunk: plugin.manualChunk,
    });
  }

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
  if (plugin.transform || plugin.transformPre || plugin.transformPost) {
    throw new Error(
      `Inline plugin '${plugin.name}' cannot declare worker-phase hooks. Use plugin(moduleSpecifier, options) instead.`,
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

  if (plugin.transformPre) {
    resolved.transformPre = resolveScopedBabelSpecs(
      plugin.transformPre,
      modulePath,
    );
  }
  if (plugin.transform) {
    resolved.transform = resolveScopedBabelSpecs(plugin.transform, modulePath);
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
      transformPost: portableScopedSpecs(resolved.transformPost),
      transformFiles: hashTransformFiles([
        resolved.transform,
        resolved.transformPre,
        resolved.transformPost,
      ]),
    }),
  );
  return resolved;
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
  const transformPost: NormalizedScopedBabelPluginSpec[] = [];

  for (const plugin of plugins) {
    transform.push(...(plugin.transform ?? []));
    transformPre.push(...(plugin.transformPre ?? []));
    transformPost.push(...(plugin.transformPost ?? []));
  }

  const profile = {
    fingerprint: contentHash(
      JSON.stringify({
        transform: portableScopedSpecs(transform),
        transformPre: portableScopedSpecs(transformPre),
        transformPost: portableScopedSpecs(transformPost),
        plugins: plugins
          .map((plugin) => plugin.workerFingerprint)
          .filter((value): value is string => Boolean(value)),
      }),
    ),
    transform,
    transformPre,
    transformPost,
  };
  return profile;
}

function portableScopedSpecs(
  value: NormalizedScopedBabelPluginSpec[] | undefined,
): unknown[] | null {
  return value
    ? value.map((entry) => ({
        modulePath: portablePathIdentity(entry.plugin.modulePath),
        options: portableFingerprintValue(entry.plugin.options),
        environments: entry.environments,
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
