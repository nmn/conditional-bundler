export type BundleManifest = {
  bundles: Array<{
    id: string;
    environmentIds: string[];
    entrypoints: Array<{
      envId: string;
      entryId: string;
      exportMode: "entry" | "dynamic";
    }>;
    /** Primary environment retained for compatibility with single-env consumers. */
    envId: string;
    entryId: string;
    fileName: string;
    /** Hash of executable JavaScript, excluding source-map comments and resource-only fingerprints. */
    runtimeHash?: string;
    exportMode?: "entry" | "dynamic";
    modules: string[];
    type?: "script";
    contentType?: string;
    conditionNames?: string[];
    mapFileName?: string;
    dependencies?: string[];
  }>;
  entrypoints: Record<
    string,
    {
      bundleId: string;
      fileName: string;
      exportMode: "entry" | "dynamic";
      /** Physical script files in the entrypoint's static dependency closure. */
      bundles: string[];
      /** Static stylesheet files the server should load for this entrypoint. */
      styles: string[];
    }
  >;
  dynamicImports: Record<string, string>;
  emittedFiles: Array<{
    fileName: string;
    originalFileName: string;
    type: "asset" | "document" | "manifest" | "style" | "source-map";
    envId?: string;
    environmentIds?: string[];
    contentType?: string;
    bundleKey?: string;
    contentHash?: string;
    global?: boolean;
  }>;
  assets?: Array<{
    fileName: string;
    type: "script" | "style" | "asset" | "document" | "manifest" | "source-map";
    contentType: string;
    envId?: string;
    environmentIds?: string[];
    entryId?: string;
    bundleKey?: string;
    global?: boolean;
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
