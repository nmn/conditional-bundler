import path from "node:path";
import fs from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  findPkgRoot,
  packagePathIdentity,
  readPkg,
  readPkgSafe,
} from "@bundler/shared";
import { runResolveImport } from "./plugins/run.js";
import { buildScopeId, type InternalBundlerConfig } from "./config.js";
import type { PackageResolverReference, Platform } from "./config.js";
import type {
  ModuleType,
  ModuleResolution,
  NormalizedPlugin,
  ResolveImportContext,
  ResolveImportKind,
  ResolveImportResult,
} from "./plugins/types.js";

export type Resolver = (
  fromId: string,
  fromFilePath: string,
  source: string,
  envId: string,
  kind?: ResolveImportKind,
  importAttributes?: Record<string, string>,
  importerMeta?: Record<string, unknown>,
) => Promise<ModuleResolution>;

export type PackageResolveOptions = {
  exportConditions?: string[];
  browserField?: boolean;
};

export type PackageResolverContext = {
  fromFilePath: string;
  request: string;
  environmentId: string;
  targetId: string;
  platform: Platform;
  kind: ResolveImportKind;
  importAttributes?: Record<string, string>;
  resolveDefault: (
    options?: PackageResolveOptions,
  ) => Promise<ResolveImportResult>;
};

export type PackageResolverHook = (
  context: PackageResolverContext,
) => Promise<ResolveImportResult | undefined> | ResolveImportResult | undefined;

type ResolverOptions = {
  config: InternalBundlerConfig;
  plugins: NormalizedPlugin[];
  cacheDir: string;
};

type DefaultResolveOptions = {
  exportConditions?: string[];
  platform?: "node" | "browser";
  browserField?: boolean;
  aliasState?: AliasState;
  seenAliases?: Set<string>;
};

type LoadedPackageResolver = {
  resolve: PackageResolverHook;
};

type AliasState = {
  packageJsonCache: Map<string, PackageJson | null>;
  tsconfigCache: Map<string, TsConfigAliasConfig | null>;
};

type PackageJson = {
  name?: string;
  main?: string;
  module?: string;
  exports?: unknown;
  imports?: Record<string, unknown>;
  browser?: string | Record<string, string | false>;
  alias?: Record<string, string | false>;
  aliases?: Record<string, string | false>;
  _moduleAliases?: Record<string, string | false>;
};

type TsConfigAliasConfig = {
  filePath: string;
  baseUrl?: string;
  paths?: Record<string, string[]>;
};

type AliasIdentityInput = {
  filePath: string;
  hash: string;
  aliases: unknown;
};

const extensions = [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".json"];
const runtimeBuiltins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

export async function createResolver(
  options: ResolverOptions,
): Promise<Resolver> {
  const aliasState = createAliasState();
  const packageResolvers = await loadTargetPackageResolvers(options.config);
  return async (
    fromId: string,
    fromFilePath: string,
    source: string,
    envId: string,
    kind: ResolveImportKind = "import",
    importAttributes,
    importerMeta,
  ) => {
    const importerScope = options.config.envs[envId];
    if (!importerScope) {
      throw new Error(`Unknown environment '${envId}'.`);
    }
    const environmentId =
      importAttributes?.environment ?? importerScope.environmentId;
    const targetId = importAttributes?.target ?? importerScope.targetId;
    if (!options.config.environments[environmentId]) {
      throw new Error(
        `Import '${source}' from '${fromFilePath}' selects unknown environment '${environmentId}'.`,
      );
    }
    if (!options.config.targets[targetId]) {
      throw new Error(
        `Import '${source}' from '${fromFilePath}' selects unknown target '${targetId}'.`,
      );
    }
    const selectedScopeId = buildScopeId(environmentId, targetId);
    const envConfig = options.config.envs[selectedScopeId];
    const requestedRepresentation = resolveImportRepresentation(
      kind,
      importAttributes,
    );
    // A representation is consumed by its importer. Its `target` attribute
    // selects the represented output (for example, a browser chunk URL), not
    // the target in which the small representation facade executes.
    const resolvedScopeId = buildScopeId(
      environmentId,
      requestedRepresentation ? importerScope.targetId : targetId,
    );

    const resolveWithTarget = async (): Promise<ResolveImportResult> => {
      const resolveDefaultForTarget = (overrides: PackageResolveOptions = {}) =>
        resolveDefault(fromFilePath, source, {
          exportConditions:
            overrides.exportConditions ?? envConfig.packageConditions,
          platform: envConfig.platform,
          browserField:
            overrides.browserField ?? envConfig.platform === "browser",
          aliasState,
        });
      const packageResolver = packageResolvers.get(envConfig.targetId);
      if (!packageResolver) return resolveDefaultForTarget();
      const result = await packageResolver.resolve({
        fromFilePath,
        request: source,
        environmentId: envConfig.environmentId,
        targetId: envConfig.targetId,
        platform: envConfig.platform,
        kind,
        importAttributes,
        resolveDefault: resolveDefaultForTarget,
      });
      if (result === undefined) return resolveDefaultForTarget();
      return result;
    };
    const context: ResolveImportContext = {
      fromId,
      fromFilePath,
      request: source,
      environmentId: envConfig.environmentId,
      targetId: envConfig.targetId,
      platform: envConfig.platform,
      kind,
      representation: requestedRepresentation,
      importAttributes,
      importerMeta,
      resolveDefault: resolveWithTarget,
    };
    const pluginResult = await runResolveImport(
      options.plugins,
      envConfig.environmentId,
      context,
    );
    const resolved =
      pluginResult === undefined ? await resolveWithTarget() : pluginResult;

    if (pluginResult === undefined && context.representation) {
      throw new Error(
        `E_UNKNOWN_REPRESENTATION: No plugin handles as: '${context.representation}' for '${source}'.`,
      );
    }

    if (resolved == null || typeof resolved !== "object") {
      throw new Error(
        `Resolver for '${source}' returned ${String(resolved)}. Return undefined to decline or { preserve: true } to preserve a runtime dependency.`,
      );
    }

    if ("preserve" in resolved) {
      if (context.representation) {
        throw new Error(
          `E_EXTERNAL_REPRESENTATION: Runtime dependency '${source}' cannot provide as: '${context.representation}'.`,
        );
      }
      const pkgRoot = findPkgRoot(fromFilePath) ?? path.dirname(fromFilePath);
      return {
        id: source,
        moduleIdentity: `runtime::${source}`,
        filePath: source,
        scopeId: resolvedScopeId,
        pkg: readPkgSafe(pkgRoot),
        target: { kind: "runtime", specifier: source },
        type: "javascript",
        representation: context.representation,
      };
    }

    if ("virtual" in resolved || "code" in resolved || "source" in resolved) {
      throw new Error(
        `Resolver for '${source}' attempted to return virtual or source-backed module data. Resolutions must point to an existing regular file.`,
      );
    }

    const filePath = path.resolve(resolved.filePath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      throw new Error(
        `Resolver returned missing file '${filePath}' for '${source}' from '${fromFilePath}'.`,
      );
    }
    if (!stat.isFile()) {
      throw new Error(
        `Resolver must return a regular file, received '${filePath}' for '${source}'.`,
      );
    }
    const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
    const pkg = readPkg(pkgRoot);
    const canonicalPath = packagePathIdentity(pkg, filePath);
    const representation = resolved.representation ?? context.representation;
    const baseModuleIdentity = resolved.moduleIdentity ?? canonicalPath;
    const normalizedAttributes = normalizeVariantAttributes(
      importAttributes,
      representation,
    );
    const representationSuffix = normalizedAttributes
      .map(([key, value]) =>
        key === "as"
          ? `::as=${encodeURIComponent(value)}`
          : `::attr=${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("");
    const environmentSuffix = `::environment=${encodeURIComponent(
      envConfig.environmentId,
    )}`;
    const moduleIdentity = `${baseModuleIdentity}${representationSuffix}${environmentSuffix}`;
    return {
      id: moduleIdentity,
      moduleIdentity,
      filePath,
      scopeId: resolvedScopeId,
      pkg,
      target: {
        kind: "file",
        moduleId: moduleIdentity,
        canonicalPath,
      },
      type: resolved.type ?? inferModuleType(filePath),
      representation,
      meta: {
        ...(resolved.meta ?? {}),
        ...(representation ? { representation } : {}),
        ...(importAttributes?.environment
          ? { requestedEnvironment: importAttributes.environment }
          : {}),
        ...(importAttributes?.target
          ? { requestedTarget: importAttributes.target }
          : {}),
        ...(normalizedAttributes.length > 0
          ? {
              importAttributes: Object.fromEntries(normalizedAttributes),
            }
          : {}),
      },
    };
  };
}

async function loadTargetPackageResolvers(
  config: InternalBundlerConfig,
): Promise<Map<string, LoadedPackageResolver>> {
  const loaded = new Map<string, LoadedPackageResolver>();
  for (const [targetId, target] of Object.entries(config.targets)) {
    if (!target.packageResolver) continue;
    const modulePath = resolvePackageResolverModule(
      target.packageResolver,
      config.configFile,
    );
    const imported = await import(pathToFileURL(modulePath).href);
    const factory = imported.default ?? imported.packageResolver ?? imported;
    const value =
      typeof factory === "function"
        ? await factory(target.packageResolver.options ?? {})
        : factory;
    const resolve =
      typeof value === "function"
        ? value
        : value && typeof value.resolvePackage === "function"
          ? value.resolvePackage.bind(value)
          : undefined;
    if (!resolve) {
      throw new Error(
        `Package resolver '${target.packageResolver.module}' for target '${targetId}' must export a resolver function or { resolvePackage() }.`,
      );
    }
    loaded.set(targetId, { resolve });
  }
  return loaded;
}

export function resolvePackageResolverModule(
  reference: PackageResolverReference,
  configFile?: string,
): string {
  const fromFile = configFile
    ? path.resolve(configFile)
    : path.join(process.cwd(), "package.json");
  if (path.isAbsolute(reference.module)) return reference.module;
  if (reference.module.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), reference.module);
  }
  return createRequire(fromFile).resolve(reference.module);
}

export function collectPackageResolverCacheIdentity(
  config: InternalBundlerConfig,
): Array<{
  targetId: string;
  modulePath: string;
  contentHash: string;
  packageName: string;
  packageVersion: string;
}> {
  return Object.entries(config.targets)
    .filter(
      (
        entry,
      ): entry is [
        string,
        (typeof entry)[1] & {
          packageResolver: PackageResolverReference;
        },
      ] => Boolean(entry[1].packageResolver),
    )
    .map(([targetId, target]) => {
      const modulePath = resolvePackageResolverModule(
        target.packageResolver,
        config.configFile,
      );
      const packageRoot = findPkgRoot(modulePath) ?? path.dirname(modulePath);
      const pkg = readPkgSafe(packageRoot);
      return {
        targetId,
        modulePath,
        contentHash: hashString(fs.readFileSync(modulePath, "utf8")),
        packageName: pkg.name,
        packageVersion: pkg.version,
      };
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
}

export function collectResolverAliasCacheIdentity(
  config: InternalBundlerConfig,
  entries: Array<{ path: string }>,
): AliasIdentityInput[] {
  const files = collectAliasConfigFiles(config, entries);
  return Array.from(files)
    .sort()
    .map((filePath) => {
      const raw = readFileIfExists(filePath);
      return {
        filePath,
        hash: raw ? hashString(raw) : "",
        aliases: raw ? readAliasIdentity(filePath, raw) : null,
      };
    });
}

export function resolveDefault(
  fromFilePath: string,
  source: string,
  options: DefaultResolveOptions = {},
): Promise<ResolveImportResult> {
  const resolvedPath = resolvePath(fromFilePath, source, options);
  if (resolvedPath == null) {
    if (runtimeBuiltins.has(source)) {
      return Promise.resolve({ preserve: true });
    }
    throw new Error(
      `Could not resolve '${source}' from '${fromFilePath}' to an existing regular file. A resolver plugin must return { preserve: true } to keep a runtime dependency.`,
    );
  }
  return Promise.resolve({
    id: resolvedPath,
    filePath: resolvedPath,
  });
}

function resolveImportRepresentation(
  kind: ResolveImportKind,
  attributes?: Record<string, string>,
): string | undefined {
  if (kind === "css-url") return "url";
  if (attributes?.as) return attributes.as;
  const legacy = attributes?.type;
  return legacy === "url" || legacy === "raw" || legacy === "base64"
    ? legacy
    : undefined;
}

function normalizeVariantAttributes(
  _attributes: Record<string, string> | undefined,
  representation: string | undefined,
): Array<[string, string]> {
  // Representation is the only import-attribute axis in transformation
  // identity. Environment is appended separately and target selects a record
  // variant; source assertions and request/link metadata do not create a
  // second transformation of the represented file.
  return representation ? [["as", representation]] : [];
}

function inferModuleType(filePath: string): ModuleType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (/\.(?:[cm]?js|jsx|tsx?|mts|cts|json)$/.test(lower)) return "javascript";
  return "asset";
}

function resolvePath(
  from: string,
  source: string,
  options: DefaultResolveOptions,
): string | null {
  const fromDir = path.dirname(from);
  if (source.startsWith(".")) {
    return resolveFileOrDirectory(path.resolve(fromDir, source), options);
  }
  if (path.isAbsolute(source)) {
    return resolveFileOrDirectory(source, options);
  }

  const alias = resolveAlias(from, source, options);
  if (alias !== undefined) {
    return alias;
  }

  return resolvePackage(fromDir, source, options);
}

function resolveAlias(
  from: string,
  source: string,
  options: DefaultResolveOptions,
): string | null | undefined {
  const state = options.aliasState;
  if (!state) {
    return undefined;
  }
  const seen = options.seenAliases ?? new Set<string>();
  const seenKey = `${from}\0${source}`;
  if (seen.has(seenKey)) {
    return undefined;
  }
  seen.add(seenKey);
  const nextOptions = { ...options, seenAliases: seen };

  if (source.startsWith("#")) {
    const packageRoot = findNearestPackageRoot(path.dirname(from));
    if (packageRoot) {
      const pkg = loadPackageJson(
        path.join(packageRoot, "package.json"),
        state,
      );
      const resolved = resolvePackageImportsAlias(
        packageRoot,
        pkg?.imports,
        source,
        nextOptions,
      );
      if (resolved !== undefined) {
        return resolved;
      }
    }
  }

  const packageAlias = resolvePackageAlias(from, source, nextOptions);
  if (packageAlias !== undefined) {
    return packageAlias;
  }

  const tsconfigAlias = resolveTsconfigAlias(from, source, nextOptions);
  if (tsconfigAlias !== undefined) {
    return tsconfigAlias;
  }

  return undefined;
}

function resolvePackageAlias(
  from: string,
  source: string,
  options: DefaultResolveOptions,
): string | null | undefined {
  const state = options.aliasState;
  if (!state) {
    return undefined;
  }
  const packageRoot = findNearestPackageRoot(path.dirname(from));
  if (!packageRoot) {
    return undefined;
  }
  const pkg = loadPackageJson(path.join(packageRoot, "package.json"), state);
  if (!pkg) {
    return undefined;
  }

  const aliasMaps: Array<Record<string, string | false> | undefined> = [
    pkg.alias,
    pkg.aliases,
    pkg._moduleAliases,
  ];
  if (
    (options.browserField ?? options.platform === "browser") &&
    pkg.browser &&
    typeof pkg.browser === "object"
  ) {
    aliasMaps.push(pkg.browser);
  }

  for (const aliasMap of aliasMaps) {
    const target = matchAliasMap(aliasMap, source);
    if (target !== undefined) {
      return resolveAliasTarget(packageRoot, target, options);
    }
  }
  return undefined;
}

function resolvePackageImportsAlias(
  packageRoot: string,
  imports: Record<string, unknown> | undefined,
  source: string,
  options: DefaultResolveOptions,
): string | null | undefined {
  if (!imports) {
    return undefined;
  }
  const target = matchSubpathMap(imports, source);
  if (target === undefined) {
    return undefined;
  }
  const selected = resolveConditionalTarget(target, options);
  if (selected === undefined) {
    return undefined;
  }
  return resolvePackageTarget(packageRoot, selected, "", options);
}

function resolveTsconfigAlias(
  from: string,
  source: string,
  options: DefaultResolveOptions,
): string | null | undefined {
  if (source.startsWith(".") || path.isAbsolute(source)) {
    return undefined;
  }
  const state = options.aliasState;
  if (!state) {
    return undefined;
  }
  const config = findNearestTsConfig(path.dirname(from), state);
  if (!config) {
    return undefined;
  }
  const paths = config.paths ?? {};
  const pathMatches = Object.entries(paths)
    .map(([pattern, targets]) => ({
      pattern,
      targets,
      match: matchPattern(pattern, source),
    }))
    .filter((item) => item.match !== null)
    .sort(
      (left, right) =>
        patternSpecificity(right.pattern) - patternSpecificity(left.pattern),
    );

  for (const item of pathMatches) {
    for (const target of item.targets) {
      const replaced = item.match ? target.replace("*", item.match) : target;
      const resolved = tryResolveFileOrDirectory(
        path.resolve(config.baseUrl ?? path.dirname(config.filePath), replaced),
        options,
      );
      if (resolved) {
        return resolved;
      }
    }
  }

  if (config.baseUrl) {
    const resolved = tryResolveFileOrDirectory(
      path.resolve(config.baseUrl, source),
      options,
    );
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function resolveAliasTarget(
  baseDir: string,
  target: string | false,
  options: DefaultResolveOptions,
): string | null {
  if (target === false) {
    return null;
  }
  if (target.startsWith(".") || path.isAbsolute(target)) {
    return resolveFileOrDirectory(path.resolve(baseDir, target), options);
  }
  return resolvePath(path.join(baseDir, "package.json"), target, options);
}

function resolvePackage(
  fromDir: string,
  source: string,
  options: DefaultResolveOptions,
): string {
  const { packageName, subpath } = splitPackageRequest(source);
  const packageRoot = findPackageRoot(fromDir, packageName);
  if (!packageRoot) {
    throw new Error(
      `Cannot resolve package '${packageName}' from '${fromDir}'`,
    );
  }
  const pkg = readPackageJson(path.join(packageRoot, "package.json")) ?? {};

  if (pkg.exports != null) {
    const exportKey = subpath ? `./${subpath}` : ".";
    const target = resolvePackageExports(pkg.exports, exportKey, options);
    if (target !== undefined) {
      return resolvePackageTarget(packageRoot, target, subpath, options);
    }
    throw new Error(`Package '${packageName}' does not export '${exportKey}'.`);
  }

  if (subpath) {
    return resolveFileOrDirectory(path.join(packageRoot, subpath), options);
  }

  const entry =
    ((options.browserField ?? options.platform === "browser") &&
    typeof pkg.browser === "string"
      ? pkg.browser
      : undefined) ??
    pkg.module ??
    pkg.main ??
    "index.js";
  return resolveFileOrDirectory(path.join(packageRoot, entry), options);
}

function resolvePackageExports(
  exportsField: unknown,
  exportKey: string,
  options: DefaultResolveOptions,
): string | undefined {
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return exportKey === "."
      ? resolveConditionalTarget(exportsField, options)
      : undefined;
  }
  if (!isRecord(exportsField)) {
    return undefined;
  }
  if (isConditionMap(exportsField)) {
    return exportKey === "."
      ? resolveConditionalTarget(exportsField, options)
      : undefined;
  }
  const target = matchSubpathMap(exportsField, exportKey);
  return target === undefined
    ? undefined
    : resolveConditionalTarget(target, options);
}

function resolvePackageTarget(
  packageRoot: string,
  target: string,
  subpath: string,
  options: DefaultResolveOptions,
): string {
  const replaced = target.includes("*") ? target.replace("*", subpath) : target;
  if (!replaced.startsWith("./")) {
    throw new Error(`Unsupported package target '${target}'.`);
  }
  return resolveFileOrDirectory(path.resolve(packageRoot, replaced), options);
}

function resolveConditionalTarget(
  target: unknown,
  options: DefaultResolveOptions,
): string | undefined {
  if (typeof target === "string") {
    return target;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = resolveConditionalTarget(item, options);
      if (selected !== undefined) {
        return selected;
      }
    }
    return undefined;
  }
  if (!isRecord(target)) {
    return undefined;
  }
  const conditions = new Set([
    ...(options.exportConditions ?? []),
    ...(options.platform ? [options.platform] : []),
    "import",
  ]);
  for (const [condition, value] of Object.entries(target)) {
    if (condition === "default" || conditions.has(condition)) {
      const selected = resolveConditionalTarget(value, options);
      if (selected !== undefined) {
        return selected;
      }
    }
  }
  return undefined;
}

function resolveFileOrDirectory(
  filePath: string,
  options: DefaultResolveOptions,
): string {
  const resolved = tryResolveFileOrDirectory(filePath, options);
  if (!resolved) {
    throw new Error(`Cannot resolve '${filePath}'`);
  }
  return resolved;
}

function tryResolveFileOrDirectory(
  filePath: string,
  options: DefaultResolveOptions,
): string | null {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  for (const ext of extensions) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const pkg = readPackageJson(path.join(filePath, "package.json"));
    const entry =
      pkg &&
      (((options.browserField ?? options.platform === "browser") &&
      typeof pkg.browser === "string"
        ? pkg.browser
        : undefined) ??
        pkg.module ??
        pkg.main);
    if (entry) {
      const resolved = tryResolveFileOrDirectory(
        path.join(filePath, entry),
        options,
      );
      if (resolved) {
        return resolved;
      }
    }
    for (const ext of extensions) {
      const candidate = path.join(filePath, `index${ext}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }
  return null;
}

function matchAliasMap(
  aliases: Record<string, string | false> | undefined,
  source: string,
): string | false | undefined {
  if (!aliases) {
    return undefined;
  }
  const target = matchSubpathMap(aliases, source);
  return typeof target === "string" || target === false ? target : undefined;
}

function matchSubpathMap(
  map: Record<string, unknown>,
  key: string,
): unknown | undefined {
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    return map[key];
  }
  const wildcard = Object.keys(map)
    .filter((pattern) => pattern.includes("*"))
    .map((pattern) => ({ pattern, match: matchPattern(pattern, key) }))
    .filter(
      (item): item is { pattern: string; match: string } => item.match !== null,
    )
    .sort(
      (left, right) =>
        patternSpecificity(right.pattern) - patternSpecificity(left.pattern),
    )[0];
  return wildcard
    ? replaceTargetWildcard(map[wildcard.pattern], wildcard.match)
    : undefined;
}

function replaceTargetWildcard(target: unknown, value: string): unknown {
  if (typeof target === "string") {
    return target.replace("*", value);
  }
  if (Array.isArray(target)) {
    return target.map((item) => replaceTargetWildcard(item, value));
  }
  if (isRecord(target)) {
    return Object.fromEntries(
      Object.entries(target).map(([key, item]) => [
        key,
        replaceTargetWildcard(item, value),
      ]),
    );
  }
  return target;
}

function matchPattern(pattern: string, value: string): string | null {
  const star = pattern.indexOf("*");
  if (star === -1) {
    return pattern === value ? "" : null;
  }
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!value.startsWith(prefix) || !value.endsWith(suffix)) {
    return null;
  }
  return value.slice(prefix.length, value.length - suffix.length);
}

function patternSpecificity(pattern: string): number {
  return pattern.replace("*", "").length;
}

function splitPackageRequest(source: string): {
  packageName: string;
  subpath: string;
} {
  const parts = source.split("/");
  const packageName = source.startsWith("@")
    ? `${parts[0]}/${parts[1]}`
    : parts[0];
  const subpath = parts.slice(source.startsWith("@") ? 2 : 1).join("/");
  return { packageName, subpath };
}

function findPackageRoot(fromDir: string, packageName: string): string | null {
  let current = fromDir;
  while (true) {
    const candidate = path.join(current, "node_modules", packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
    const next = path.dirname(current);
    if (next === current) {
      return null;
    }
    current = next;
  }
}

function findNearestPackageRoot(fromDir: string): string | null {
  let current = fromDir;
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) {
      return null;
    }
    current = next;
  }
}

function findNearestTsConfig(
  fromDir: string,
  state: AliasState,
): TsConfigAliasConfig | null {
  let current = fromDir;
  while (true) {
    for (const name of ["tsconfig.json", "tsconfig.base.json"]) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate)) {
        const loaded = loadTsConfig(candidate, state);
        if (loaded?.baseUrl || loaded?.paths) {
          return loaded;
        }
      }
    }
    const next = path.dirname(current);
    if (next === current) {
      return null;
    }
    current = next;
  }
}

function loadPackageJson(
  filePath: string,
  state: AliasState,
): PackageJson | null {
  if (!state.packageJsonCache.has(filePath)) {
    state.packageJsonCache.set(filePath, readPackageJson(filePath));
  }
  return state.packageJsonCache.get(filePath) ?? null;
}

function readPackageJson(filePath: string): PackageJson | null {
  const raw = readFileIfExists(filePath);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function loadTsConfig(
  filePath: string,
  state: AliasState,
): TsConfigAliasConfig | null {
  if (state.tsconfigCache.has(filePath)) {
    return state.tsconfigCache.get(filePath) ?? null;
  }

  const raw = readFileIfExists(filePath);
  if (!raw) {
    state.tsconfigCache.set(filePath, null);
    return null;
  }

  let parsed: {
    extends?: string;
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch {
    state.tsconfigCache.set(filePath, null);
    return null;
  }

  const base = parsed.extends
    ? loadTsConfig(resolveTsConfigExtends(filePath, parsed.extends), state)
    : null;
  const compilerOptions = parsed.compilerOptions ?? {};
  const loaded: TsConfigAliasConfig = {
    filePath,
    baseUrl:
      compilerOptions.baseUrl != null
        ? path.resolve(path.dirname(filePath), compilerOptions.baseUrl)
        : base?.baseUrl,
    paths: compilerOptions.paths ?? base?.paths,
  };
  state.tsconfigCache.set(filePath, loaded);
  return loaded;
}

function resolveTsConfigExtends(fromFile: string, request: string): string {
  const withJson = request.endsWith(".json") ? request : `${request}.json`;
  if (request.startsWith(".") || path.isAbsolute(request)) {
    return path.resolve(path.dirname(fromFile), withJson);
  }
  return resolvePackage(path.dirname(fromFile), withJson, {
    exportConditions: ["default"],
    platform: "node",
  });
}

function collectAliasConfigFiles(
  config: InternalBundlerConfig,
  entries: Array<{ path: string }>,
): Set<string> {
  const startDirs = new Set<string>([process.cwd()]);
  if (config.configFile) {
    startDirs.add(path.dirname(path.resolve(config.configFile)));
  }
  for (const entry of entries) {
    startDirs.add(path.dirname(path.resolve(entry.path)));
  }

  const files = new Set<string>();
  for (const startDir of startDirs) {
    let current = startDir;
    while (true) {
      for (const name of [
        "package.json",
        "tsconfig.json",
        "tsconfig.base.json",
      ]) {
        const candidate = path.join(current, name);
        if (fs.existsSync(candidate)) {
          files.add(candidate);
        }
      }
      const next = path.dirname(current);
      if (next === current) {
        break;
      }
      current = next;
    }
  }
  return files;
}

function readAliasIdentity(filePath: string, raw: string): unknown {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (path.basename(filePath) === "package.json") {
    return {
      imports: parsed.imports,
      alias: parsed.alias,
      aliases: parsed.aliases,
      _moduleAliases: parsed._moduleAliases,
      browser: parsed.browser,
    };
  }
  return {
    extends: parsed.extends,
    compilerOptions:
      parsed.compilerOptions && typeof parsed.compilerOptions === "object"
        ? {
            baseUrl: (parsed.compilerOptions as Record<string, unknown>)
              .baseUrl,
            paths: (parsed.compilerOptions as Record<string, unknown>).paths,
          }
        : undefined,
  };
}

function stripJsonComments(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConditionMap(value: Record<string, unknown>): boolean {
  return !Object.keys(value).some((key) => key.startsWith("."));
}

function createAliasState(): AliasState {
  return {
    packageJsonCache: new Map(),
    tsconfigCache: new Map(),
  };
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function hashString(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}
