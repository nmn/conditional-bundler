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

const assetExtensions = new Set([
  ...imageExtensions,
  ".eot",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".pdf",
  ".ttf",
  ".wav",
  ".wasm",
  ".webm",
  ".woff",
  ".woff2",
]);

export default function assetImportsBabelPlugin(api, options = {}) {
  api.assertVersion(7);
  const t = api.types;
  const imageRepresentation =
    options.imageRepresentation === undefined
      ? "image-reference-with-size"
      : options.imageRepresentation;
  const assetRepresentation =
    options.assetRepresentation === undefined
      ? "url"
      : options.assetRepresentation;

  return {
    name: "bare-asset-imports-as-attributes",
    visitor: {
      ImportDeclaration(importPath) {
        if (readAttribute(importPath.node, "as", t)) return;
        const extension = requestExtension(importPath.node.source.value);
        const representation = imageExtensions.has(extension)
          ? imageRepresentation
          : assetExtensions.has(extension)
            ? assetRepresentation
            : false;
        if (representation === false || representation == null) return;
        if (typeof representation !== "string" || !representation) {
          throw importPath.buildCodeFrameError(
            "Asset import representations must be a non-empty string or false.",
          );
        }
        importPath.node.attributes = [
          ...(importPath.node.attributes ?? importPath.node.assertions ?? []),
          t.importAttribute(
            t.identifier("as"),
            t.stringLiteral(representation),
          ),
        ];
        importPath.node.assertions = undefined;
      },
    },
  };
}

function requestExtension(request) {
  const pathname = request.split(/[?#]/, 1)[0].toLowerCase();
  const slash = pathname.lastIndexOf("/");
  const dot = pathname.lastIndexOf(".");
  return dot > slash ? pathname.slice(dot) : "";
}

function readAttribute(node, key, t) {
  return (node.attributes ?? node.assertions ?? []).find(
    (attribute) =>
      t.isImportAttribute(attribute) &&
      readAttributeKey(attribute, t) === key &&
      t.isStringLiteral(attribute.value),
  )?.value.value;
}

function readAttributeKey(attribute, t) {
  return t.isIdentifier(attribute.key)
    ? attribute.key.name
    : t.isStringLiteral(attribute.key)
      ? attribute.key.value
      : undefined;
}
