export type BundleManifest = {
  bundles: Array<{
    id: string;
    scopeIds: string[];
    environmentIds: string[];
    targetIds: string[];
    entrypoints: Array<{
      envId: string;
      environmentId: string;
      targetId: string;
      entryId: string;
      exportMode: "entry" | "dynamic";
    }>;
    environmentId: string;
    targetId: string;
    platform: "node" | "browser";
    /** Concrete environment/target scope used by internal lookup keys. */
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
      environmentId: string;
      targetId: string;
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
    environmentId?: string;
    targetId?: string;
    scopeIds?: string[];
    environmentIds?: string[];
    targetIds?: string[];
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
    environmentId?: string;
    targetId?: string;
    scopeIds?: string[];
    environmentIds?: string[];
    targetIds?: string[];
    entryId?: string;
    bundleKey?: string;
    global?: boolean;
    modules?: string[];
    conditionNames?: string[];
  }>;
  documents?: Array<{
    envId: string;
    environmentId: string;
    targetId: string;
    entryId: string;
    fileName: string;
    scripts: string[];
    styles: string[];
    assets: string[];
  }>;
  metadata: Record<string, unknown>;
};
