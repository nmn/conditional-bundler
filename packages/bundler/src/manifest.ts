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
    type: "asset" | "document" | "manifest" | "style" | "source-map";
    envId?: string;
    contentType?: string;
    bundleKey?: string;
    contentHash?: string;
  }>;
  assets?: Array<{
    fileName: string;
    type: "script" | "style" | "asset" | "document" | "manifest" | "source-map";
    contentType: string;
    envId?: string;
    entryId?: string;
    bundleKey?: string;
    modules?: string[];
    conditionNames?: string[];
  }>;
  documents?: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    scripts: string[];
    styles: string[];
    assets: string[];
  }>;
  metadata: Record<string, unknown>;
};
