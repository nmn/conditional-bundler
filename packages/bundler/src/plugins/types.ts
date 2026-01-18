import type { TransformInput, TransformResult, TransformMultiResult } from "@bundler/shared";
import type { ModuleGraph } from "../graph/build.js";

export type TransformModuleHook = (input: TransformInput) => Promise<TransformResult | TransformMultiResult>;

export type TransformModuleGraphHook = (graphs: ModuleGraph[]) => Promise<ModuleGraph[]>;

export type TransformAssetsHook = (assets: Record<string, string>) => Promise<Record<string, string>>;

export type BundlerPlugin = {
  name: string;
  transformModule?: TransformModuleHook;
  transformModuleGraph?: TransformModuleGraphHook;
  transformAssets?: TransformAssetsHook;
};
