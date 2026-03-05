import type { BundlerPlugin, TransformModuleHookWithContext } from "./types.js";
import type { TransformInput } from "@bundler/shared";
import type { ModuleGraph } from "../graph/build.js";

export async function runTransformModule(
  plugins: BundlerPlugin[],
  input: TransformInput,
): Promise<ReturnType<TransformModuleHookWithContext> | undefined> {
  let current: Awaited<ReturnType<TransformModuleHookWithContext>> | undefined;
  for (const plugin of plugins) {
    if (plugin.transformModule) {
      current = await plugin.transformModule({
        ...input,
        previousResult: current,
      });
    }
  }
  return current;
}

export async function runTransformModuleGraph(
  plugins: BundlerPlugin[],
  graphs: ModuleGraph[],
): Promise<ModuleGraph[]> {
  let current = graphs;
  for (const plugin of plugins) {
    if (plugin.transformModuleGraph) {
      current = await plugin.transformModuleGraph(current);
    }
  }
  return current;
}

export async function runTransformAssets(
  plugins: BundlerPlugin[],
  assets: Record<string, string>,
): Promise<Record<string, string>> {
  let current = assets;
  for (const plugin of plugins) {
    if (plugin.transformAssets) {
      current = await plugin.transformAssets(current);
    }
  }
  return current;
}
