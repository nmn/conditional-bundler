import path from "node:path";
import { findPkgRoot, readJsonIfExists } from "@bundler/shared";
import {
  buildScopeId,
  type BundlerConfig,
  type EntrySpec,
  type InternalBundlerConfig,
  type InternalEntrySpec,
} from "../config.js";

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
  config: BundlerConfig | InternalBundlerConfig,
  entries: Array<EntrySpec | InternalEntrySpec>,
): Promise<ResolvedDevOptions> {
  const hmr = config.dev?.hmr === true;
  const fullReloadOnFailure = config.dev?.fullReloadOnFailure ?? true;
  const port = config.dev?.port ?? 3000;
  const host = config.dev?.host ?? "127.0.0.1";
  const reactRefreshConfig = config.dev?.reactRefresh;
  const reactDetected = await detectReactDependency(entries);
  const reactRefreshEnvs = new Set<string>();

  if (hmr && reactDetected && reactRefreshConfig !== false) {
    const explicitEnvironments =
      typeof reactRefreshConfig === "object"
        ? reactRefreshConfig.environments
        : undefined;
    const explicitTargets =
      typeof reactRefreshConfig === "object"
        ? reactRefreshConfig.targets
        : undefined;
    for (const [targetId, target] of Object.entries(config.targets)) {
      if (target.platform !== "browser") continue;
      if (explicitTargets && !explicitTargets.includes(targetId)) continue;
      for (const environmentId of Object.keys(config.environments)) {
        if (
          explicitEnvironments &&
          !explicitEnvironments.includes(environmentId)
        ) {
          continue;
        }
        reactRefreshEnvs.add(buildScopeId(environmentId, targetId));
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
