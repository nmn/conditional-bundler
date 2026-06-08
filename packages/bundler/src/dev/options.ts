import path from "node:path";
import { findPkgRoot, readJsonIfExists } from "@bundler/shared";
import type { BundlerConfig, EntrySpec } from "../config.js";

export type ResolvedDevOptions = {
  hmr: boolean;
  reactRefreshEnvs: Set<string>;
  fullReloadOnFailure: boolean;
  port: number;
  host: string;
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export async function resolveDevOptions(
  config: BundlerConfig,
  entries: EntrySpec[],
): Promise<ResolvedDevOptions> {
  const hmr = config.dev?.hmr === true;
  const fullReloadOnFailure = config.dev?.fullReloadOnFailure ?? true;
  const port = config.dev?.port ?? 3000;
  const host = config.dev?.host ?? "127.0.0.1";
  const reactRefreshConfig = config.dev?.reactRefresh;
  const reactDetected = await detectReactDependency(entries);
  const reactRefreshEnvs = new Set<string>();

  if (hmr && reactDetected && reactRefreshConfig !== false) {
    const explicitEnvs =
      typeof reactRefreshConfig === "object" ? reactRefreshConfig.envs : null;
    for (const [envId, envConfig] of Object.entries(config.envs)) {
      if (explicitEnvs && !explicitEnvs.includes(envId)) {
        continue;
      }
      if (envConfig.target === "browser") {
        reactRefreshEnvs.add(envId);
      }
    }
  }

  return {
    hmr,
    reactRefreshEnvs,
    fullReloadOnFailure,
    port,
    host,
  };
}

async function detectReactDependency(entries: EntrySpec[]): Promise<boolean> {
  const pkgRoots = new Set<string>();
  for (const entry of entries) {
    const entryPath = path.resolve(entry.path);
    const pkgRoot = findPkgRoot(entryPath);
    if (pkgRoot) {
      pkgRoots.add(pkgRoot);
    }
  }

  for (const pkgRoot of pkgRoots) {
    const pkg = await readJsonIfExists<PackageJson>(
      path.join(pkgRoot, "package.json"),
    );
    if (pkg && packageHasReactDependency(pkg)) {
      return true;
    }
  }
  return false;
}

function packageHasReactDependency(pkg: PackageJson): boolean {
  return [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ].some((deps) => deps && Object.prototype.hasOwnProperty.call(deps, "react"));
}
