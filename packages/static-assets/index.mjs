import crypto from "node:crypto";

export function createAssetReference(assetId) {
  const digest = crypto
    .createHash("sha1")
    .update(`${assetId}\0asset-url`)
    .digest("hex");
  const short = BigInt(`0x${digest}`).toString(36).slice(0, 10);
  return {
    id: `${assetId}::asset-url`,
    kind: "asset-url",
    symbol: `__bundler_${short}_asset_url`,
    assetId,
  };
}

export function isStaticAssetRequest(request) {
  if (
    typeof request !== "string" ||
    /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/|#)/.test(request)
  ) {
    return false;
  }
  const pathname = request.split(/[?#]/, 1)[0].toLowerCase();
  return assetExtensions.some((extension) => pathname.endsWith(extension));
}

const assetExtensions = [
  ".avif",
  ".bmp",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".pdf",
  ".png",
  ".svg",
  ".ttf",
  ".wav",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
];
