import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPkgRoot, packagePathIdentity, readPkgSafe } from "@bundler/shared";
import { isStaticAssetRequest } from "./index.mjs";

const transformPath = fileURLToPath(
  new URL("./transform.mjs", import.meta.url),
);

export default function staticAssetsBundlerPlugin(options = {}) {
  const resolveRepresentation = (context) =>
    resolveBuiltInRepresentation(context, context.representation);
  return {
    name: options.name ?? "static-assets",
    representations: {
      url: { resolve: resolveRepresentation },
      url_and_deps_array: { resolve: resolveRepresentation },
      raw: { resolve: resolveRepresentation },
      base64: { resolve: resolveRepresentation },
      "image-reference-with-size": { resolve: resolveRepresentation },
    },
    async resolveImport(context) {
      if (!isStaticAssetRequest(context.request)) return undefined;
      return resolveBuiltInRepresentation(
        context,
        isImageRequest(context.request) ? "image-reference-with-size" : "url",
      );
    },
    transform: [[transformPath, options]],
  };
}

async function resolveBuiltInRepresentation(context, representation) {
  if (
    ![
      "url",
      "url_and_deps_array",
      "raw",
      "base64",
      "image-reference-with-size",
    ].includes(representation)
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
  const implementationEnvironment =
    context.importAttributes?.environment ?? context.environmentId;
  const normalModuleIdentity = `${assetId}::environment=${encodeURIComponent(
    implementationEnvironment,
  )}`;
  const normalType = inferModuleType(filePath);
  if (
    representation === "image-reference-with-size" &&
    !isImageRequest(filePath)
  ) {
    throw new Error(
      `E_REPRESENTATION_TYPE: as: 'image-reference-with-size' requires an image, received '${context.request}'.`,
    );
  }
  if (representation === "url_and_deps_array" && normalType !== "javascript") {
    throw new Error(
      `E_REPRESENTATION_TYPE: as: 'url_and_deps_array' requires a JavaScript module, received '${context.request}'.`,
    );
  }
  return {
    id: assetId,
    moduleIdentity: assetId,
    filePath,
    type: "asset",
    representation,
    meta: {
      assetId,
      request: context.request,
      representation,
      representationHandler: `static-assets::as=${representation}`,
      normalModuleIdentity,
      normalType,
      primaryOutputType:
        normalType === "css"
          ? "style"
          : normalType === "javascript"
            ? "script"
            : "asset",
      requestedEnvironment: context.importAttributes?.environment,
      requestedTarget: context.importAttributes?.target,
      requestedUrlMode: context.importAttributes?.urlMode,
    },
  };
}

function inferModuleType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (/\.(?:[cm]?js|jsx|tsx?|mts|cts|json)$/.test(lower)) return "javascript";
  return "asset";
}

function isImageRequest(request) {
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(request);
}
