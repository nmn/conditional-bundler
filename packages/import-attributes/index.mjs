const legacyRepresentations = new Set(["url", "raw", "base64"]);

export default function importAttributesBabelPlugin(api) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "canonical-import-attributes",
    visitor: {
      ImportDeclaration(importPath) {
        const attributes = [
          ...(importPath.node.attributes ?? importPath.node.assertions ?? []),
        ];
        const legacy = readAttribute(attributes, "type", t);
        if (!legacyRepresentations.has(legacy)) return;
        const current = readAttribute(attributes, "as", t);
        if (current && current !== legacy) {
          throw importPath.buildCodeFrameError(
            `E_IMPORT_REPRESENTATION_CONFLICT: type: '${legacy}' conflicts with as: '${current}'.`,
          );
        }
        importPath.node.attributes = [
          ...attributes.filter(
            (attribute) =>
              !(
                t.isImportAttribute(attribute) &&
                readAttributeKey(attribute, t) === "type"
              ),
          ),
          ...(current
            ? []
            : [t.importAttribute(t.identifier("as"), t.stringLiteral(legacy))]),
        ];
        importPath.node.assertions = undefined;
      },
    },
  };
}

function readAttribute(attributes, key, t) {
  return attributes.find(
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
