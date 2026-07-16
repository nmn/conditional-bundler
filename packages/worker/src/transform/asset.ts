import path from "node:path";
import { imageSize } from "image-size";
import {
  contentHash,
  contentHashShort,
  portableSourceName,
  type LinkReference,
  type TransformResult,
} from "@bundler/shared";
import { prepareCoreTransform, transformWithCore } from "./core.js";

export type AssetTransformInput = {
  id: string;
  moduleIdentity: string;
  canonicalPath: string;
  realPath: string;
  bytes: Uint8Array;
  intent: "url" | "raw" | "base64" | "assetPath";
  assetId: string;
  pkg: { name: string; version: string; root: string };
  envs: string[];
  envId: string;
  dev?: { hmr?: boolean };
};

const imageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

export function transformAsset(input: AssetTransformInput): TransformResult {
  const reference = createAssetReference(input.assetId);
  const extension = path.extname(input.realPath).toLowerCase();
  let facade: string;
  if (input.intent === "raw") {
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      throw new Error(
        `Raw asset '${input.canonicalPath}' is not valid UTF-8. Use base64 intent for binary data.`,
      );
    }
    facade = `export default ${JSON.stringify(value)};`;
  } else if (input.intent === "base64") {
    facade = `export default ${JSON.stringify(Buffer.from(input.bytes).toString("base64"))};`;
  } else if (input.intent === "assetPath") {
    facade = "void 0;";
  } else {
    const dimensions = imageExtensions.has(extension)
      ? readImageDimensions(input.bytes, input.canonicalPath)
      : undefined;
    facade = `export default { src: ${reference.symbol}${
      dimensions
        ? `, width: ${dimensions.width}, height: ${dimensions.height}`
        : ""
    } };`;
  }

  const prepared = prepareCoreTransform(
    {
      code: facade,
      realPath: input.realPath,
      syntax: { jsx: false, ts: false },
    },
    portableSourceName(input.canonicalPath),
  );
  const result = transformWithCore(
    {
      id: input.id,
      moduleIdentity: input.moduleIdentity,
      canonicalPath: input.canonicalPath,
      symbolIdentity: `${input.assetId}::intent=${input.intent}`,
      code: facade,
      realPath: input.realPath,
      pkg: input.pkg,
      syntax: { jsx: false, ts: false },
      envs: input.envs,
      envId: input.envId,
      resolvedImports: {},
      dev: input.dev,
    },
    {
      importAttrAllow: [],
      generateModuleOutput: false,
    },
    prepared,
  );

  const shouldCopy = input.intent === "url" || input.intent === "assetPath";
  const references: LinkReference[] = input.intent === "url" ? [reference] : [];
  return {
    ...result,
    fileRecord: result.fileRecord
      ? {
          ...result.fileRecord,
          linkReferences: references,
          extraOutputs: shouldCopy
            ? {
                "bundler-asset": {
                  contents: input.bytes,
                  metadata: {
                    assetId: input.assetId,
                    canonicalPath: input.canonicalPath,
                    sourceFileName: path.basename(input.realPath),
                    extension,
                    contentHash: contentHash(input.bytes),
                    copy: true,
                  },
                },
              }
            : undefined,
          cells: result.fileRecord.cells.map((cell) => ({
            ...cell,
            linkReferences:
              cell.code && cell.code.includes(reference.symbol)
                ? references
                : undefined,
          })),
        }
      : undefined,
  };
}

function createAssetReference(
  assetId: string,
): Extract<LinkReference, { kind: "asset-url" }> {
  return {
    id: `${assetId}::asset-url`,
    kind: "asset-url",
    symbol: `__bundler_${contentHashShort(`${assetId}\0asset-url`, 10)}_asset_url`,
    assetId,
    usage: "javascript",
  };
}

function readImageDimensions(
  bytes: Uint8Array,
  canonicalPath: string,
): { width: number; height: number } {
  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(bytes);
  } catch (error) {
    throw new Error(
      `Could not read image dimensions for '${canonicalPath}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    !dimensions.width ||
    !dimensions.height ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height)
  ) {
    throw new Error(
      `Image '${canonicalPath}' does not have deterministic numeric dimensions.`,
    );
  }
  return { width: dimensions.width, height: dimensions.height };
}
