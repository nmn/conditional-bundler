import { getEnvListValue, getEnvValue } from "./normalize.js";
import type {
  AfterCombineContext,
  BeforeCombineContext,
  BuildEndContext,
  BuildStartContext,
  BundlePlanDraft,
  LoadContext,
  LoadResult,
  NormalizedPlugin,
  ResolveImportContext,
  ResolveImportResult,
} from "./types.js";

export async function runBuildStart(
  plugins: NormalizedPlugin[],
  context: BuildStartContext,
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.buildStart?.(context);
  }
}

export async function runResolveImport(
  plugins: NormalizedPlugin[],
  envId: string,
  context: ResolveImportContext,
): Promise<ResolveImportResult | undefined> {
  for (const plugin of plugins) {
    const hook = getEnvValue(plugin.resolveImport, envId);
    if (!hook) {
      continue;
    }
    const result = await hook(context);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export async function runLoad(
  plugins: NormalizedPlugin[],
  envId: string,
  context: LoadContext,
): Promise<LoadResult | undefined> {
  for (const plugin of plugins) {
    const hook = getEnvValue(plugin.load, envId);
    if (!hook) {
      continue;
    }
    const result = await hook(context);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

export async function runBeforeCombine(
  plugins: NormalizedPlugin[],
  context: BeforeCombineContext,
): Promise<BundlePlanDraft[]> {
  let current = context.plans;
  for (const plugin of plugins) {
    const hooks = getEnvListValue(plugin.beforeCombine, context.envId);
    for (const hook of hooks) {
      const next = await hook({ ...context, plans: current });
      if (next) {
        current = next;
      }
    }
  }
  return current;
}

export async function runAfterCombine(
  plugins: NormalizedPlugin[],
  context: AfterCombineContext,
): Promise<{ code: string; map?: string }> {
  let current = { code: context.code, map: context.map };
  for (const plugin of plugins) {
    const hooks = getEnvListValue(plugin.afterCombine, context.envId);
    for (const hook of hooks) {
      const next = await hook({ ...context, ...current });
      if (typeof next === "string") {
        current = { code: next, map: current.map };
        continue;
      }
      if (next) {
        current = {
          code: next.code,
          map: next.map ?? current.map,
        };
      }
    }
  }
  return current;
}

export async function runBuildEnd(
  plugins: NormalizedPlugin[],
  context: BuildEndContext,
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.buildEnd?.(context);
  }
}
