import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { findPkgRoot, readPkg, readPkgSafe } from "@bundler/shared";
import { runResolveImport } from "./plugins/run.js";
import type { BundlerConfig } from "./config.js";
import type {
  ModuleResolution,
  NormalizedPlugin,
  ResolveImportContext,
  ResolveImportKind,
  ResolveImportResult,
} from "./plugins/types.js";

const requireFromHere = createRequire(import.meta.url);

export type Resolver = (
  fromId: string,
  fromFilePath: string,
  source: string,
  envId: string,
  kind?: ResolveImportKind,
  importAttributes?: Record<string, string>,
) => Promise<ModuleResolution>;

type ResolverOptions = {
  config: BundlerConfig;
  plugins: NormalizedPlugin[];
  cacheDir: string;
};

export function createResolver(options: ResolverOptions): Resolver {
  return async (
    fromId: string,
    fromFilePath: string,
    source: string,
    envId: string,
    kind: ResolveImportKind = "import",
    importAttributes,
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
      importAttributes,
      resolveDefault: async () => resolveDefault(fromFilePath, source),
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

    if (resolved === null) {
      const pkgRoot = findPkgRoot(fromFilePath) ?? path.dirname(fromFilePath);
      return {
        id: source,
        filePath: source,
        pkg: readPkgSafe(pkgRoot),
        external: true,
      };
    }

    const filePath = resolved.virtual
      ? createVirtualFilePath(options.cacheDir, resolved.id)
      : path.resolve(resolved.filePath);
    const pkgRoot = findPkgRoot(filePath) ?? path.dirname(filePath);
    const pkg = readPkg(pkgRoot);
    return {
      id: resolved.id,
      filePath,
      pkg,
      external: false,
      virtual: resolved.virtual,
      meta: resolved.meta,
    };
  };
}

export function resolveDefault(
  fromFilePath: string,
  source: string,
): Promise<ResolveImportResult> {
  const resolvedPath = resolvePath(fromFilePath, source);
  return Promise.resolve({
    id: resolvedPath,
    filePath: resolvedPath,
  });
}

function resolvePath(from: string, source: string): string {
  if (source.startsWith(".")) {
    const base = path.dirname(from);
    const candidate = path.resolve(base, source);
    return resolveWithExtensions(candidate);
  }
  return requireFromHere.resolve(source, { paths: [path.dirname(from)] });
}

function resolveWithExtensions(filePath: string): string {
  const extensions = [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs"];
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  for (const ext of extensions) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  if (fs.existsSync(path.join(filePath, "index.js"))) {
    return path.join(filePath, "index.js");
  }
  throw new Error(`Cannot resolve '${filePath}'`);
}

function createVirtualFilePath(cacheDir: string, id: string): string {
  const hash = createHash("sha1").update(id).digest("hex").slice(0, 12);
  return path.join(cacheDir, "virtual", `${hash}.js`);
}
