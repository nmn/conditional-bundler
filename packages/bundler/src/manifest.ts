export type BundleManifest = {
  bundles: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    modules: string[];
    type?: "script";
    contentType?: string;
    conditionNames?: string[];
    mapFileName?: string;
  }>;
  dynamicImports: Record<string, string>;
  emittedFiles: Array<{
    fileName: string;
    originalFileName: string;
    type: "asset" | "manifest" | "style" | "source-map";
    envId?: string;
    contentType?: string;
    bundleKey?: string;
  }>;
  assets?: Array<{
    fileName: string;
    type: "script" | "style" | "asset" | "manifest" | "source-map";
    contentType: string;
    envId?: string;
    entryId?: string;
    bundleKey?: string;
    modules?: string[];
    conditionNames?: string[];
  }>;
  metadata: Record<string, unknown>;
};
