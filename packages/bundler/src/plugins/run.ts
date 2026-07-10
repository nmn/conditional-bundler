import { getEnvListValue, getEnvValue } from "./normalize.js";
import { parseSourceMap } from "../sourcemap/compose.js";
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
  let current = normalizeBundlePlans(context.plans);
  for (const plugin of plugins) {
    const hooks = getEnvListValue(plugin.beforeCombine, context.envId);
    for (const hook of hooks) {
      const next = await hook({ ...context, plans: current });
      if (next) {
        current = normalizeBundlePlans(next);
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
        if (current.map && next !== current.code) {
          throw new Error(
            `Plugin '${plugin.name}' changed combined code without returning an updated source map.`,
          );
        }
        current = { code: next, map: current.map };
        continue;
      }
      if (next) {
        if (current.map && next.code !== current.code && !next.map) {
          throw new Error(
            `Plugin '${plugin.name}' changed combined code without returning an updated source map.`,
          );
        }
        if (next.map) {
          parseSourceMap(next.map);
        }
        current = {
          code: next.code,
          map: next.map ?? current.map,
        };
      }
    }
  }
  return current;
}

function normalizeBundlePlans(plans: BundlePlanDraft[]): BundlePlanDraft[] {
  return plans.map((plan) => ({
    ...plan,
    orderedParts: (plan.orderedParts as unknown[]).map((part) =>
      typeof part === "string" ? { code: part } : part,
    ),
  })) as BundlePlanDraft[];
}

export async function runBuildEnd(
  plugins: NormalizedPlugin[],
  context: BuildEndContext,
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.buildEnd?.(context);
  }
}
