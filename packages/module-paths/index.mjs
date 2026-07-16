import crypto from "node:crypto";

const METADATA_KEY = "conditionalBundlerLinkReferences";

export default function modulePathsBabelPlugin(api) {
  api.assertVersion(7);
  const t = api.types;

  return {
    name: "module-paths",
    visitor: {
      ReferencedIdentifier(identifierPath, state) {
        const name = identifierPath.node.name;
        if (name !== "__dirname" && name !== "__filename") {
          return;
        }
        if (identifierPath.scope.hasBinding(name)) {
          return;
        }
        const kind =
          name === "__dirname" ? "module-dirname" : "module-filename";
        replaceWithReference(identifierPath, state, kind, t);
      },
      MemberExpression(memberPath, state) {
        if (!isImportMeta(memberPath.node.object, t)) {
          return;
        }
        const property = readPropertyName(memberPath.node, t);
        if (property === "url" && isStaticNewUrlBase(memberPath, t)) {
          return;
        }
        if (property === "hot" || property == null) {
          return;
        }
        const kind =
          property === "url"
            ? "module-url"
            : property === "dirname"
              ? "module-dirname"
              : property === "filename"
                ? "module-filename"
                : null;
        if (!kind) {
          return;
        }
        replaceWithReference(memberPath, state, kind, t);
      },
    },
  };
}

function isStaticNewUrlBase(memberPath, t) {
  const parent = memberPath.parentPath;
  return Boolean(
    parent?.isNewExpression() &&
    t.isIdentifier(parent.node.callee, { name: "URL" }) &&
    parent.node.arguments[1] === memberPath.node,
  );
}

export function createModulePathReference(moduleIdentity, kind) {
  if (typeof moduleIdentity !== "string" || moduleIdentity.length === 0) {
    throw new Error("module-paths requires a stable moduleIdentity.");
  }
  const digest = crypto
    .createHash("sha1")
    .update(`${moduleIdentity}\0${kind}`)
    .digest("hex");
  const short = BigInt(`0x${digest}`).toString(36).slice(0, 10);
  const suffix = kind.slice("module-".length).replaceAll("-", "_");
  return {
    id: `${moduleIdentity}::${kind}`,
    kind,
    symbol: `__bundler_${short}_${suffix}`,
    ownerId: moduleIdentity,
  };
}

function replaceWithReference(targetPath, state, kind, t) {
  const options = state.opts ?? {};
  const target = options.target ?? "browser";
  if (target === "browser" && kind !== "module-url") {
    throw targetPath.buildCodeFrameError(
      `${kind === "module-dirname" ? "__dirname/import.meta.dirname" : "__filename/import.meta.filename"} is only available in Node-target bundles. Import an asset to obtain a browser URL.`,
    );
  }
  const reference = createModulePathReference(options.moduleIdentity, kind);
  const existing = state.file.metadata[METADATA_KEY] ?? [];
  if (!existing.some((item) => item.id === reference.id)) {
    state.file.metadata[METADATA_KEY] = [...existing, reference];
  }
  const replacement = t.identifier(reference.symbol);
  replacement.loc = targetPath.node.loc;
  targetPath.replaceWith(replacement);
}

function isImportMeta(node, t) {
  return (
    t.isMetaProperty(node) &&
    t.isIdentifier(node.meta, { name: "import" }) &&
    t.isIdentifier(node.property, { name: "meta" })
  );
}

function readPropertyName(node, t) {
  if (!node.computed && t.isIdentifier(node.property)) {
    return node.property.name;
  }
  return t.isStringLiteral(node.property) ? node.property.value : null;
}

export { modulePathsBabelPlugin };
