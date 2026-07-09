import type {
  CloudflareKVRemoteCacheConfig,
  FileRemoteCacheConfig,
} from "@bundler/shared";

export type CloudflareKVCacheOptions = {
  accountId: string;
  namespaceId: string;
  apiTokenEnv: string;
  prefix?: string;
};

export type FileRemoteCacheOptions = {
  dir: string;
  prefix?: string;
};

export function cloudflareKVCache(
  options: CloudflareKVCacheOptions,
): CloudflareKVRemoteCacheConfig {
  return {
    kind: "cloudflare-kv",
    accountId: options.accountId,
    namespaceId: options.namespaceId,
    apiTokenEnv: options.apiTokenEnv,
    prefix: options.prefix,
  };
}

export function fileRemoteCache(
  options: FileRemoteCacheOptions,
): FileRemoteCacheConfig {
  return {
    kind: "file",
    dir: options.dir,
    prefix: options.prefix,
  };
}
