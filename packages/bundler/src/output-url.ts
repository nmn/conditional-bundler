import type { OutputSpec } from "./config.js";

export const defaultRootURL = "/";

export function resolveRootURL(
  outputs: Pick<OutputSpec, "rootURL" | "publicPath">,
): string {
  return outputs.rootURL ?? outputs.publicPath ?? defaultRootURL;
}

export function joinRootURL(rootURL: string, fileName: string): string {
  const root = rootURL.replace(/\/+$/, "");
  const relativePath = fileName.replaceAll("\\", "/").replace(/^\/+/, "");
  return root ? `${root}/${relativePath}` : `/${relativePath}`;
}
