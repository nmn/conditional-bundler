export type BundleManifest = {
  bundles: Array<{
    envId: string;
    entryId: string;
    fileName: string;
    modules: string[];
  }>;
  dynamicImports: Record<string, string>;
};
