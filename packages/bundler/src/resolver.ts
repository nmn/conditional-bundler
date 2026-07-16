import path from "node:path";
import fs from "node:fs";
import { builtinModules } from "node:module";
import { createHash } from "node:crypto";
import {
  findPkgRoot,
  packagePathIdentity,
  readPkg,
  readPkgSafe,
} from "@bundler/shared";
import { runResolveImport } from "./plugins/run.js";
import type { BundlerConfig } from "./config.js";
import type {
  ImportIntent,
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

type ResolverOptions = {
  config: BundlerConfig;
  plugins: NormalizedPlugin[];
  cacheDir: string;
};

type DefaultResolveOptions = {
  conditions?: string[];
  target?: "node" | "browser";
  aliasState?: AliasState;
  seenAliases?: Set<string>;
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

export function createResolver(options: ResolverOptions): Resolver {
  const aliasState = createAliasState();
  return async (
    fromId: string,
    fromFilePath: string,
    source: string,
    envId: string,
    kind: ResolveImportKind = "import",
    importAttributes,
    importerMeta,
  ) => {
    const envConfig = options.config.envs[envId];
    if (!envConfig) {
      throw new Error(`Unknown environment '${envId}'.`);
    }

    const context: ResolveImportContext = {
      fromId,
      fromFilePath,
      request: source,
      envId,
      conditions: envConfig.conditions,
      target: envConfig.target,
      kind,
      intent: resolveImportIntent(kind, importAttributes),
      importAttributes,
      importerMeta,
      resolveDefault: async () =>
        resolveDefault(fromFilePath, source, {
          conditions: envConfig.conditions,
          target: envConfig.target,
          aliasState,
        }),
    };
    const pluginResult = await runResolveImport(
      options.plugins,
      envId,
      context,
    );
    const resolved =
      pluginResult === undefined
        ? await context.resolveDefault()
        : pluginResult;

    if (resolved == null || typeof resolved !== "object") {
      throw new Error(
        `Resolver for '${source}' returned ${String(resolved)}. Return undefined to decline or { preserve: true } to preserve a runtime dependency.`,
      );
    }

    if ("preserve" in resolved) {
      const pkgRoot = findPkgRoot(fromFilePath) ?? path.dirname(fromFilePath);
      return {
        id: source,
        moduleIdentity: `runtime::${source}`,
        filePath: source,
        pkg: readPkgSafe(pkgRoot),
        target: { kind: "runtime", specifier: source },
        type: "javascript",
        intent: context.intent,
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
    return {
      id: resolved.id,
      moduleIdentity: resolved.moduleIdentity ?? canonicalPath,
      filePath,
      pkg,
      target: {
        kind: "file",
        moduleId: resolved.moduleIdentity ?? canonicalPath,
        canonicalPath,
      },
      type: resolved.type ?? inferModuleType(filePath),
      intent: resolved.intent ?? context.intent,
      meta: resolved.meta,
    };
  };
}

export function collectResolverAliasCacheIdentity(
  config: BundlerConfig,
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

function resolveImportIntent(
  kind: ResolveImportKind,
  attributes?: Record<string, string>,
): ImportIntent {
  if (kind === "css-url") return "assetPath";
  const requested = attributes?.type;
  if (
    requested === "url" ||
    requested === "raw" ||
    requested === "base64" ||
    requested === "assetPath"
  ) {
    return requested;
  }
  return "module";
}

function inferModuleType(filePath: string): ModuleType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (/\.(?:[cm]?js|jsx|tsx?|mts|cts)$/.test(lower)) return "javascript";
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
    options.target === "browser" &&
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
    (options.target === "browser" && typeof pkg.browser === "string"
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
    ...(options.conditions ?? []),
    ...(options.target ? [options.target] : []),
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
      ((options.target === "browser" && typeof pkg.browser === "string"
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
    conditions: ["default"],
    target: "node",
  });
}

function collectAliasConfigFiles(
  config: BundlerConfig,
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
