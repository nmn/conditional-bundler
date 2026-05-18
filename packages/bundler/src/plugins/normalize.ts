import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { contentHash, findPkgRoot, readPkgSafe } from "@bundler/shared";
import type {
  BabelPluginSpec,
  BundlerPlugin,
  EnvValue,
  InlineBundlerPlugin,
  ModuleBundlerPlugin,
  NormalizedBabelPluginSpec,
  NormalizedPlugin,
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
      load: plugin.load,
      beforeCombine: plugin.beforeCombine,
      afterCombine: plugin.afterCombine,
      buildEnd: plugin.buildEnd,
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

  const resolved: NormalizedPlugin = {
    ...plugin,
    modulePath,
  };

  if (plugin.transformPre) {
    resolved.transformPre = resolveEnvBabelSpecs(
      plugin.transformPre,
      modulePath,
    );
  }
  if (plugin.transform) {
    resolved.transform = resolveEnvBabelSpecs(plugin.transform, modulePath);
  }
  if (plugin.transformPost) {
    resolved.transformPost = resolveEnvBabelSpecs(
      plugin.transformPost,
      modulePath,
    );
  }

  const pkgRoot = findPkgRoot(modulePath) ?? path.dirname(modulePath);
  const pkg = readPkgSafe(pkgRoot);
  resolved.workerFingerprint = contentHash(
    JSON.stringify({
      name: plugin.name,
      modulePath,
      moduleHash: hashFileIfExists(modulePath),
      version: pkg.version,
      options: pluginRef.options ?? null,
      transform: serializeEnvSpecs(resolved.transform),
      transformPre: serializeEnvSpecs(resolved.transformPre),
      transformPost: serializeEnvSpecs(resolved.transformPost),
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
  values: Array<EnvValue<NormalizedBabelPluginSpec[]> | undefined>,
): Record<string, string | null> {
  const modulePaths = new Set<string>();
  for (const value of values) {
    const specs = serializeEnvSpecs(value);
    for (const entries of Object.values(specs ?? {})) {
      for (const entry of entries) {
        modulePaths.add(entry.modulePath);
      }
    }
  }
  return Object.fromEntries(
    Array.from(modulePaths)
      .sort()
      .map((modulePath) => [modulePath, hashFileIfExists(modulePath)]),
  );
}

function hashFileIfExists(filePath: string): string | null {
  try {
    return contentHash(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveEnvBabelSpecs(
  value: EnvValue<BabelPluginSpec[]>,
  fromModulePath: string,
): EnvValue<NormalizedBabelPluginSpec[]> {
  if (!isEnvMap(value)) {
    return value.map((entry) => resolveBabelSpec(entry, fromModulePath));
  }

  const resolved: { default?: NormalizedBabelPluginSpec[] } & Record<
    string,
    NormalizedBabelPluginSpec[] | undefined
  > = {};
  if (value.default) {
    resolved.default = value.default.map((entry) =>
      resolveBabelSpec(entry, fromModulePath),
    );
  }
  for (const [envId, entries] of Object.entries(value)) {
    if (envId === "default" || !entries) {
      continue;
    }
    resolved[envId] = entries.map((entry) =>
      resolveBabelSpec(entry, fromModulePath),
    );
  }
  return resolved;
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
  const transformPre = new Map<string, NormalizedBabelPluginSpec[]>();
  const transform = new Map<string, NormalizedBabelPluginSpec[]>();
  const transformPost = new Map<string, NormalizedBabelPluginSpec[]>();

  for (const plugin of plugins) {
    for (const envId of envKeys(plugin.transform)) {
      const current = transform.get(envId) ?? [];
      current.push(...getEnvListValue(plugin.transform, envId));
      transform.set(envId, current);
    }
    for (const envId of envKeys(plugin.transformPre)) {
      const current = transformPre.get(envId) ?? [];
      current.push(...getEnvListValue(plugin.transformPre, envId));
      transformPre.set(envId, current);
    }
    for (const envId of envKeys(plugin.transformPost)) {
      const current = transformPost.get(envId) ?? [];
      current.push(...getEnvListValue(plugin.transformPost, envId));
      transformPost.set(envId, current);
    }
  }

  const profile = {
    fingerprint: contentHash(
      JSON.stringify({
        transform: Object.fromEntries(transform.entries()),
        transformPre: Object.fromEntries(transformPre.entries()),
        transformPost: Object.fromEntries(transformPost.entries()),
        plugins: plugins
          .map((plugin) => plugin.workerFingerprint)
          .filter((value): value is string => Boolean(value)),
      }),
    ),
    transform: Object.fromEntries(transform.entries()),
    transformPre: Object.fromEntries(transformPre.entries()),
    transformPost: Object.fromEntries(transformPost.entries()),
  };
  return profile;
}

function envKeys<T>(value: EnvValue<T[]> | undefined): string[] {
  if (!value) {
    return [];
  }
  if (!isEnvMap(value)) {
    return ["default"];
  }
  const keys = new Set<string>();
  if (value.default) {
    keys.add("default");
  }
  for (const envId of Object.keys(value)) {
    if (envId !== "default") {
      keys.add(envId);
    }
  }
  return Array.from(keys);
}

function serializeEnvSpecs(
  value: EnvValue<NormalizedBabelPluginSpec[]> | undefined,
): Record<string, NormalizedBabelPluginSpec[]> | null {
  if (!value) {
    return null;
  }
  if (!isEnvMap(value)) {
    return { default: value };
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, entries]) => Array.isArray(entries)),
  ) as Record<string, NormalizedBabelPluginSpec[]>;
}
