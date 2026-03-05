import type {
  TransformInput,
  TransformResult,
  TransformMultiResult,
} from "@bundler/shared";
import type { ModuleGraph } from "../graph/build.js";

export type TransformModuleInput = TransformInput & {
  previousResult?: TransformResult | TransformMultiResult;
};

export type TransformModuleHookWithContext = (
  input: TransformModuleInput,
) => Promise<TransformResult | TransformMultiResult>;

export type TransformModuleGraphHook = (
  graphs: ModuleGraph[],
) => Promise<ModuleGraph[]>;

export type TransformAssetsHook = (
  assets: Record<string, string>,
) => Promise<Record<string, string>>;

export type BundlerPlugin = {
  name: string;
  transformModule?: TransformModuleHookWithContext;
  transformModuleGraph?: TransformModuleGraphHook;
  transformAssets?: TransformAssetsHook;
};
