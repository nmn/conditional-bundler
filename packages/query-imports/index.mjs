const representations = new Set(["url", "raw", "base64"]);

export default function queryImportsBabelPlugin(api) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "query-imports-as-attributes",
    visitor: {
      ImportDeclaration(importPath) {
        const normalized = normalizeRequest(importPath.node.source.value);
        if (!normalized) return;
        const current = readAttribute(importPath.node, "as", t);
        if (current && current !== normalized.representation) {
          throw importPath.buildCodeFrameError(
            `E_IMPORT_REPRESENTATION_CONFLICT: Query requests '${normalized.representation}' but the import has as: '${current}'.`,
          );
        }
        importPath.node.source.value = normalized.request;
        if (!current) {
          importPath.node.attributes = [
            ...(importPath.node.attributes ?? importPath.node.assertions ?? []),
            createAttribute("as", normalized.representation, t),
          ];
          importPath.node.assertions = undefined;
        }
      },
    },
  };
}

export function normalizeRequest(request) {
  const queryIndex = request.indexOf("?");
  if (queryIndex < 0) return null;
  if (request.includes("#", queryIndex)) {
    throw new Error(
      `E_IMPORT_QUERY: Import representation queries cannot contain fragments: '${request}'.`,
    );
  }
  const pathname = request.slice(0, queryIndex);
  const raw = request.slice(queryIndex + 1);
  if (!pathname || !raw) {
    throw new Error(`E_IMPORT_QUERY: Malformed import query '${request}'.`);
  }
  const parts = raw.split("&");
  const containsEncodedPart = parts.some((part) => {
    try {
      return decodeURIComponent(part) !== part;
    } catch {
      throw new Error(`E_IMPORT_QUERY: Malformed import query '${request}'.`);
    }
  });
  if (
    parts.some(
      (part) => !part || part.includes("=") || !/^[a-z][a-z0-9-]*$/i.test(part),
    ) ||
    containsEncodedPart
  ) {
    throw new Error(`E_IMPORT_QUERY: Malformed import query '${request}'.`);
  }
  if (new Set(parts).size !== parts.length) {
    throw new Error(`E_IMPORT_QUERY: Duplicate import query in '${request}'.`);
  }
  const flags = new Set(parts);
  const requested = parts.filter((part) => representations.has(part));
  const validWorkerUrl =
    flags.size === 2 && flags.has("worker") && flags.has("url");
  const validSingle =
    flags.size === 1 && requested.length === 1 && !flags.has("worker");
  if (!validWorkerUrl && !validSingle) {
    throw new Error(
      `E_IMPORT_QUERY: Unsupported import representation query '${request}'.`,
    );
  }
  return {
    request: pathname,
    representation: validWorkerUrl ? "url" : requested[0],
  };
}

function createAttribute(key, value, t) {
  return t.importAttribute(t.identifier(key), t.stringLiteral(value));
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
