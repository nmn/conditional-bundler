export type BundleManifest = {
  bundles: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    modules: string[];
  }>;
  dynamicImports: Record<string, string>;
  emittedFiles: Array<{
    fileName: string;
    originalFileName: string;
    type: "asset" | "manifest";
    envId?: string;
  }>;
  metadata: Record<string, unknown>;
};
