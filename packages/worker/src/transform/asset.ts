import path from "node:path";
import { imageSize } from "image-size";
import {
  contentHash,
  contentHashShort,
  portableSourceName,
  type LinkReference,
  type TransformResolvedImport,
  type TransformResult,
} from "@bundler/shared";
import {
  prepareCoreTransform,
  transformWithCore,
  type PreparedCoreTransform,
} from "./core.js";

export type AssetTransformInput = {
  id: string;
  moduleIdentity: string;
  canonicalPath: string;
  realPath: string;
  bytes: Uint8Array;
  representation:
    | "url"
    | "url_and_deps_array"
    | "raw"
    | "base64"
    | "image-reference-with-size";
  assetId: string;
  normalModuleIdentity: string;
  normalType: "javascript" | "css" | "asset";
  primaryOutputType: string;
  requestedEnvironment?: string;
  requestedTarget?: string;
  requestedUrlMode?: "module-relative" | "public";
  pkg: { name: string; version: string; root: string };
  envs: string[];
  envId: string;
  dev?: { hmr?: boolean };
};

export type PreparedAssetTransform = {
  facade: string;
  prepared: PreparedCoreTransform;
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

export function prepareAssetTransform(
  input: AssetTransformInput,
): PreparedAssetTransform {
  const graphIdentity = portableAssetGraphIdentity(input);
  const extension = path.extname(input.realPath).toLowerCase();
  let facade: string;
  if (input.representation === "raw") {
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      throw new Error(
        `Raw representation '${input.canonicalPath}' is not valid UTF-8. Use as: 'base64' for binary data.`,
      );
    }
    facade = `export default ${JSON.stringify(value)};`;
  } else if (input.representation === "base64") {
    facade = `export default ${JSON.stringify(Buffer.from(input.bytes).toString("base64"))};`;
  } else if (input.representation === "image-reference-with-size") {
    if (!imageExtensions.has(extension)) {
      throw new Error(
        `Representation 'image-reference-with-size' requires an image: '${input.canonicalPath}'.`,
      );
    }
    const dimensions = readImageDimensions(input.bytes, input.canonicalPath);
    const selfRequest = `./${path.basename(input.realPath)}`;
    facade = `import __bundler_image_url from ${JSON.stringify(selfRequest)} with { as: "url" };
export default { src: __bundler_image_url, width: ${dimensions.width}, height: ${dimensions.height} };`;
  } else {
    const reference = createOutputReference(
      input.normalType === "asset" ? input.assetId : input.normalModuleIdentity,
      input.normalType === "asset" ? "asset" : input.primaryOutputType,
      graphIdentity,
      input.representation === "url_and_deps_array",
      input.requestedUrlMode ??
        (input.requestedTarget ? "public" : "module-relative"),
      input.requestedEnvironment,
      input.requestedTarget,
    );
    facade = `export default ${reference.symbol};`;
  }
  return {
    facade,
    prepared: prepareCoreTransform(
      {
        code: facade,
        realPath: input.realPath,
        syntax: { jsx: false, ts: false },
      },
      portableSourceName(input.canonicalPath),
    ),
  };
}

export function transformAsset(
  input: AssetTransformInput,
  resolvedImports: Record<string, TransformResolvedImport> = {},
  preparation = prepareAssetTransform(input),
): TransformResult {
  const graphIdentity = portableAssetGraphIdentity(input);
  const copiedOutput =
    input.normalType === "asset" && input.representation === "url";
  const outputId = copiedOutput ? input.assetId : input.normalModuleIdentity;
  const reference =
    input.representation === "url" ||
    input.representation === "url_and_deps_array"
      ? createOutputReference(
          outputId,
          copiedOutput ? "asset" : input.primaryOutputType,
          graphIdentity,
          input.representation === "url_and_deps_array",
          input.requestedUrlMode ??
            (input.requestedTarget ? "public" : "module-relative"),
          input.requestedEnvironment,
          input.requestedTarget,
        )
      : undefined;
  const extension = path.extname(input.realPath).toLowerCase();
  const { facade, prepared } = preparation;
  const result = transformWithCore(
    {
      id: graphIdentity,
      moduleIdentity: graphIdentity,
      canonicalPath: input.canonicalPath,
      symbolIdentity: graphIdentity,
      code: facade,
      realPath: input.realPath,
      pkg: input.pkg,
      syntax: { jsx: false, ts: false },
      envs: input.envs,
      envId: input.envId,
      resolvedImports,
      dev: input.dev,
    },
    {
      importAttrAllow: [],
      generateModuleOutput: false,
    },
    structuredClone(prepared),
  );

  const references: LinkReference[] = reference ? [reference] : [];
  const discoveredEntrypoints =
    (input.representation === "url" ||
      input.representation === "url_and_deps_array") &&
    input.normalType !== "asset"
      ? [
          {
            self: "normal" as const,
            moduleIdentity: input.normalModuleIdentity,
            moduleType: input.normalType,
            exportMode: "entry" as const,
            ...(input.requestedEnvironment
              ? { environment: input.requestedEnvironment }
              : {}),
            ...(input.requestedTarget
              ? { targets: [input.requestedTarget] }
              : {}),
          },
        ]
      : [];
  return {
    ...result,
    fileRecord: result.fileRecord
      ? {
          ...result.fileRecord,
          moduleIdentity: input.moduleIdentity,
          discoveredEntrypoints,
          linkReferences: references,
          extraOutputs: copiedOutput
            ? {
                "bundler-asset": {
                  outputId: input.assetId,
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
              reference && cell.code && cell.code.includes(reference.symbol)
                ? references
                : undefined,
          })),
        }
      : undefined,
  };
}

function portableAssetGraphIdentity(input: AssetTransformInput): string {
  return input.id === input.moduleIdentity ||
    input.id.startsWith(`${input.moduleIdentity}::link=`)
    ? input.id
    : input.moduleIdentity;
}

function createOutputReference(
  outputId: string,
  outputType: string,
  ownerId: string,
  includeDependencies = false,
  urlMode: "module-relative" | "public" = "module-relative",
  environment?: string,
  targetId?: string,
): Extract<LinkReference, { kind: "output-url" }> & { symbol: string } {
  return {
    id: `${ownerId}::output-url:${outputId}`,
    kind: "output-url",
    symbol: `__bundler_${contentHashShort(`${ownerId}\0${outputId}\0output-url`, 10)}_output_url`,
    outputId,
    outputType,
    ownerId,
    ...(includeDependencies ? { includeDependencies: true } : {}),
    ...(urlMode !== "module-relative" ? { urlMode } : {}),
    ...(environment ? { environment } : {}),
    ...(targetId ? { targetId } : {}),
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
