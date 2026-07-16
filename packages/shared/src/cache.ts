import fs from "node:fs/promises";
import path from "node:path";

export type CachePaths = {
  codePath: string;
  mapPath?: string;
  irPath: string;
};

export type CloudflareKVRemoteCacheConfig = {
  kind: "cloudflare-kv";
  accountId: string;
  namespaceId: string;
  apiTokenEnv: string;
  prefix?: string;
};

export type FileRemoteCacheConfig = {
  kind: "file";
  dir: string;
  prefix?: string;
};

export type RemoteCacheConfig =
  | CloudflareKVRemoteCacheConfig
  | FileRemoteCacheConfig;

export type CacheConfig = {
  local?: {
    dir?: string;
    retentionDays?: number;
  };
  remote?: RemoteCacheConfig | false;
};

export type RemoteCacheAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileAtomic(
  filePath: string,
  content: string | Uint8Array,
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content);
  await fs.rename(tempPath, filePath);
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
}

export async function readFileIfExists(
  filePath: string,
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  const raw = await readFileIfExists(filePath);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function createRemoteCacheAdapter(
  config: RemoteCacheConfig | undefined,
  namespace = "default",
): RemoteCacheAdapter | null {
  if (!config) return null;
  const prefix = joinRemoteKey(config.prefix, namespace);
  if (config.kind === "file") {
    return {
      async get(key) {
        try {
          return await fs.readFile(path.join(config.dir, prefix, key), "utf8");
        } catch {
          return null;
        }
      },
      async set(key, value) {
        await writeFileAtomic(path.join(config.dir, prefix, key), value);
      },
    };
  }
  const token = process.env[config.apiTokenEnv];
  if (!token) {
    throw new Error(
      `Cloudflare KV cache token env '${config.apiTokenEnv}' is not set.`,
    );
  }
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    config.accountId,
  )}/storage/kv/namespaces/${encodeURIComponent(config.namespaceId)}/values`;
  return {
    async get(key) {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(joinRemoteKey(prefix, key))}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(
          `Cloudflare KV cache read failed (${response.status}).`,
        );
      }
      return response.text();
    },
    async set(key, value) {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(joinRemoteKey(prefix, key))}`,
        {
          method: "PUT",
          headers: { authorization: `Bearer ${token}` },
          body: value,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Cloudflare KV cache write failed (${response.status}).`,
        );
      }
    },
  };
}

export function joinRemoteKey(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .join("/");
}
