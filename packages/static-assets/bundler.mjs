import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPkgRoot, packagePathIdentity, readPkgSafe } from "@bundler/shared";
import { isStaticAssetRequest } from "./index.mjs";

const transformPath = fileURLToPath(
  new URL("./transform.mjs", import.meta.url),
);

export default function staticAssetsBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "static-assets",
    async resolveImport(context) {
      if (
        !isStaticAssetRequest(context.request) &&
        !["url", "raw", "base64", "assetPath"].includes(context.intent)
      ) {
        return undefined;
      }
      const resolved = await context.resolveDefault();
      if ("preserve" in resolved) {
        return resolved;
      }
      const filePath = path.resolve(resolved.filePath);
      const root = findPkgRoot(filePath) ?? path.dirname(filePath);
      const assetId = packagePathIdentity(readPkgSafe(root), filePath);
      const intent = context.intent === "module" ? "url" : context.intent;
      const moduleIdentity = `${assetId}::intent=${intent}`;
      return {
        id: moduleIdentity,
        moduleIdentity,
        filePath,
        type: "asset",
        intent,
        meta: { assetId, request: context.request, intent },
      };
    },
    transform: [
      [
        transformPath,
        {
          ...options,
          __bundlerEnvironmentIndependent: true,
        },
      ],
    ],
  };
}
