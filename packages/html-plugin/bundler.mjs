import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import {
  GenMapping,
  addSegment,
  setSourceContent,
  toEncodedMap,
} from "@jridgewell/gen-mapping";
import { parse } from "parse5";
import {
  findPkgRoot,
  normalizePosixPath,
  packagePathIdentity,
  readPkgSafe,
} from "@bundler/shared";

const requireFromPlugin = createRequire(import.meta.url);
const parse5Package = readPkgSafe(
  findPkgRoot(requireFromPlugin.resolve("parse5")) ?? process.cwd(),
);

export default function htmlBundlerPlugin(options = {}) {
  return {
    name: options.name ?? "html-plugin",
    resourceFingerprint: `html-plugin-v2:parse5@${parse5Package.version}`,
    transformDocument(context) {
      if (!context.filePath.toLowerCase().endsWith(".html")) {
        return undefined;
      }
      if (context.target !== "browser") {
        throw new Error(
          `HTML entry '${context.filePath}' requires a browser target.`,
        );
      }
      return transformHtmlDocument(context);
    },
  };
}

function transformHtmlDocument(context) {
  const document = parse(context.source, { sourceCodeLocationInfo: true });
  const root = findPkgRoot(context.filePath) ?? path.dirname(context.filePath);
  const pkg = readPkgSafe(root);
  const ownerId = packagePathIdentity(pkg, context.filePath);
  const baseHref = findBaseHref(document);
  const externalBase = Boolean(baseHref && !isLocalUrl(baseHref));
  const documentRequest = (request) =>
    externalBase
      ? null
      : resolveDocumentUrl(request, context.filePath, root, baseHref);
  const modifications = [];
  const references = [];
  const scripts = [];
  const styles = [];
  let itemIndex = 0;

  walk(document, (node) => {
    if (!node.tagName || !node.sourceCodeLocation) {
      return;
    }
    const tagName = node.tagName.toLowerCase();
    const attrs = new Map(
      (node.attrs ?? []).map((attribute) => [
        attribute.name.toLowerCase(),
        attribute.value,
      ]),
    );

    if (tagName === "script") {
      const moduleScript = attrs.get("type")?.toLowerCase() === "module";
      const src = attrs.get("src");
      const resolvedSrc = src ? documentRequest(src) : null;
      if (moduleScript && resolvedSrc) {
        const id = resolvedSrc;
        const reference = createOutputReference(
          ownerId,
          `script-${itemIndex++}`,
          id,
          "script",
        );
        replaceAttributeValue(
          modifications,
          context.source,
          node,
          "src",
          reference.id,
        );
        references.push(reference);
        addIntegrityReference(
          modifications,
          references,
          context.source,
          node,
          ownerId,
          reference,
        );
        scripts.push({ id, request: id, module: true });
        return;
      }
      if (moduleScript && !src) {
        const location = node.sourceCodeLocation;
        if (!location.startTag || !location.endTag) {
          return;
        }
        const code = context.source.slice(
          location.startTag.endOffset,
          location.endTag.startOffset,
        );
        const hash = shortHash(
          `${ownerId}\0inline-script\0${itemIndex}\0${code}`,
        );
        const request = `./.conditional-bundler/${hash}.inline.js`;
        const moduleIdentity = `${ownerId}::inline-script:${hash}`;
        const map = createInlineSourceMap(
          code,
          context.source,
          ownerId,
          offsetToPosition(context.source, location.startTag.endOffset),
        );
        const reference = createOutputReference(
          ownerId,
          `script-${itemIndex++}`,
          request,
          "script",
        );
        modifications.push({
          start: location.startTag.endOffset - 1,
          end: location.startTag.endOffset - 1,
          parts: [
            { kind: "text", value: ' src="' },
            {
              kind: "reference",
              referenceId: reference.id,
              encoding: "html-attribute",
            },
            { kind: "text", value: '"' },
          ],
        });
        modifications.push({
          start: location.startTag.endOffset,
          end: location.endTag.startOffset,
          parts: [],
        });
        references.push(reference);
        scripts.push({ id: request, code, map, module: true, moduleIdentity });
        return;
      }
      if (resolvedSrc) {
        replaceAssetAttribute(
          modifications,
          references,
          context.source,
          node,
          "src",
          ownerId,
          resolvedSrc,
          itemIndex++,
        );
      }
      return;
    }

    if (
      tagName === "link" &&
      attrs.get("rel")?.toLowerCase().split(/\s+/).includes("stylesheet")
    ) {
      const href = attrs.get("href");
      const resolvedHref = href ? documentRequest(href) : null;
      if (resolvedHref) {
        const style = createStyleEntry(resolvedHref);
        const reference = createOutputReference(
          ownerId,
          `style-${itemIndex}`,
          style.id,
          "style",
        );
        replaceAttributeValue(
          modifications,
          context.source,
          node,
          "href",
          reference.id,
        );
        references.push(reference);
        addIntegrityReference(
          modifications,
          references,
          context.source,
          node,
          ownerId,
          reference,
        );
        styles.push(style);
      }
      return;
    }

    if (tagName === "style") {
      const location = node.sourceCodeLocation;
      if (!location.startTag || !location.endTag) {
        return;
      }
      const css = context.source.slice(
        location.startTag.endOffset,
        location.endTag.startOffset,
      );
      const hash = shortHash(`${ownerId}\0inline-style\0${itemIndex}\0${css}`);
      const cssRequest = `./.conditional-bundler/${hash}.inline.css`;
      const moduleIdentity = `${ownerId}::inline-style:${hash}`;
      const style = createStyleEntry(cssRequest, css, moduleIdentity);
      itemIndex += 1;
      const reference = createOutputReference(
        ownerId,
        `style-${itemIndex}`,
        style.id,
        "style",
      );
      modifications.push({
        start: location.startOffset,
        end: location.endOffset,
        parts: [
          { kind: "text", value: '<link rel="stylesheet" href="' },
          {
            kind: "reference",
            referenceId: reference.id,
            encoding: "html-attribute",
          },
          { kind: "text", value: '">' },
        ],
      });
      references.push(reference);
      styles.push(style);
      return;
    }

    for (const attributeName of assetAttributesForTag(tagName, attrs)) {
      const value = attrs.get(attributeName);
      const resolvedValue = value ? documentRequest(value) : null;
      if (!resolvedValue) {
        continue;
      }
      replaceAssetAttribute(
        modifications,
        references,
        context.source,
        node,
        attributeName,
        ownerId,
        resolvedValue,
        itemIndex++,
      );
    }
    const srcset = attrs.get("srcset");
    if (srcset && (tagName === "img" || tagName === "source")) {
      replaceSrcsetAttribute(
        modifications,
        references,
        context.source,
        node,
        ownerId,
        srcset,
        documentRequest,
        () => itemIndex++,
      );
    }
  });

  const scriptOutputIds = Array.from(
    new Set(
      scripts.filter((script) => script.module).map((script) => script.id),
    ),
  );
  if (scriptOutputIds.length > 0) {
    const reference = {
      id: `${ownerId}::document-script-styles`,
      kind: "output-styles",
      outputIds: scriptOutputIds,
      ownerId,
    };
    const insertionOffset = findStyleLinkInsertionOffset(document);
    modifications.push({
      start: insertionOffset,
      end: insertionOffset,
      parts: [
        {
          kind: "reference",
          referenceId: reference.id,
          encoding: "html-elements",
        },
      ],
    });
    references.push(reference);
  }

  return {
    template: {
      parts: applyModifications(context.source, modifications),
      references,
    },
    scripts,
    styles,
    references,
  };
}

function findStyleLinkInsertionOffset(document) {
  let offset = 0;
  walk(document, (node) => {
    if (node.tagName?.toLowerCase() !== "head") return;
    const location = node.sourceCodeLocation;
    offset =
      location?.endTag?.startOffset ?? location?.startTag?.endOffset ?? 0;
  });
  return offset;
}

function createStyleEntry(cssRequest, code, moduleIdentity) {
  return { id: cssRequest, request: cssRequest, code, moduleIdentity };
}

function replaceAssetAttribute(
  modifications,
  references,
  source,
  node,
  attributeName,
  ownerId,
  request,
  index,
) {
  const reference = {
    id: `${ownerId}::html-asset:${index}:${request}`,
    kind: "asset-url",
    symbol: `__bundler_html_${shortHash(`${ownerId}\0${request}`)}_asset_url`,
    assetId: "",
    ownerId,
    request: normalizeDocumentRequest(request),
  };
  replaceAttributeValue(
    modifications,
    source,
    node,
    attributeName,
    reference.id,
  );
  references.push(reference);
}

function replaceAttributeValue(
  modifications,
  source,
  node,
  attributeName,
  referenceId,
) {
  const range = attributeValueRange(source, node, attributeName);
  if (!range) return;
  modifications.push({
    start: range.start,
    end: range.end,
    parts: [
      {
        kind: "reference",
        referenceId,
        encoding: "html-attribute",
      },
    ],
  });
}

function replaceSrcsetAttribute(
  modifications,
  references,
  source,
  node,
  ownerId,
  value,
  resolveRequest,
  nextIndex,
) {
  const range = attributeValueRange(source, node, "srcset");
  if (!range) return;
  const parts = [];
  for (const candidate of parseSrcset(value)) {
    const request = resolveRequest(candidate.url);
    if (!request) {
      parts.push({ kind: "text", value: candidate.raw });
      continue;
    }
    const index = nextIndex();
    const reference = {
      id: `${ownerId}::html-asset:${index}:${request}`,
      kind: "asset-url",
      symbol: `__bundler_html_${shortHash(`${ownerId}\0${request}`)}_asset_url`,
      assetId: "",
      ownerId,
      request,
    };
    references.push(reference);
    parts.push(
      { kind: "text", value: candidate.prefix },
      {
        kind: "reference",
        referenceId: reference.id,
        encoding: "html-srcset",
      },
      { kind: "text", value: candidate.suffix },
    );
  }
  modifications.push({ start: range.start, end: range.end, parts });
}

function parseSrcset(value) {
  const candidates = [];
  let offset = 0;
  while (offset < value.length) {
    const start = offset;
    while (/\s/.test(value[offset] ?? "")) offset += 1;
    const urlStart = offset;
    const dataUrl = value.startsWith("data:", urlStart);
    while (offset < value.length && !/\s/.test(value[offset])) {
      if (!dataUrl && value[offset] === ",") break;
      offset += 1;
    }
    const urlEnd = offset;
    while (offset < value.length && value[offset] !== ",") offset += 1;
    if (offset < value.length) offset += 1;
    const end = offset;
    if (urlEnd === urlStart) {
      candidates.push({ raw: value.slice(start, end), url: "" });
      continue;
    }
    candidates.push({
      raw: value.slice(start, end),
      prefix: value.slice(start, urlStart),
      url: value.slice(urlStart, urlEnd),
      suffix: value.slice(urlEnd, end),
    });
  }
  return candidates;
}

function attributeValueRange(source, node, attributeName) {
  const location = node.sourceCodeLocation?.attrs?.[attributeName];
  if (!location) return null;
  const slice = source.slice(location.startOffset, location.endOffset);
  const equals = slice.indexOf("=");
  if (equals === -1) return null;
  let start = equals + 1;
  while (/\s/.test(slice[start] ?? "")) start += 1;
  const quote =
    slice[start] === '"' || slice[start] === "'" ? slice[start++] : "";
  const endInSlice = quote ? slice.lastIndexOf(quote) : slice.length;
  return {
    start: location.startOffset + start,
    end: location.startOffset + endInSlice,
  };
}

function applyModifications(source, modifications) {
  const parts = [];
  let offset = 0;
  for (const modification of modifications.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  )) {
    if (modification.start < offset) {
      throw new Error("Overlapping HTML template modifications.");
    }
    if (modification.start > offset) {
      parts.push({
        kind: "text",
        value: source.slice(offset, modification.start),
      });
    }
    parts.push(...modification.parts);
    offset = modification.end;
  }
  if (offset < source.length) {
    parts.push({ kind: "text", value: source.slice(offset) });
  }
  return parts;
}

function createOutputReference(ownerId, name, outputId, outputType) {
  return {
    id: `${ownerId}::${name}`,
    kind: "output-url",
    outputId,
    outputType,
    ownerId,
  };
}

function addIntegrityReference(
  modifications,
  references,
  source,
  node,
  ownerId,
  outputReference,
) {
  if (!node.attrs?.some((attribute) => attribute.name === "integrity")) {
    return;
  }
  const reference = {
    id: `${outputReference.id}:integrity`,
    kind: "output-integrity",
    outputId: outputReference.outputId,
    outputType: outputReference.outputType,
    ownerId,
  };
  replaceAttributeValue(modifications, source, node, "integrity", reference.id);
  references.push(reference);
}

function createInlineSourceMap(code, html, sourceName, start) {
  const map = new GenMapping({ file: `${sourceName}::inline.js` });
  setSourceContent(map, sourceName, html);
  const lines = code.split("\n");
  for (let line = 0; line < lines.length; line += 1) {
    addSegment(
      map,
      line,
      0,
      sourceName,
      start.line + line,
      line === 0 ? start.column : 0,
    );
  }
  return JSON.stringify(toEncodedMap(map));
}

function offsetToPosition(source, offset) {
  let line = 0;
  let column = 0;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function assetAttributesForTag(tagName, attrs) {
  const names = [];
  if (
    ["img", "audio", "video", "source", "track", "iframe", "embed"].includes(
      tagName,
    )
  )
    names.push("src");
  if (["video"].includes(tagName)) names.push("poster");
  if (["object"].includes(tagName)) names.push("data");
  if (
    tagName === "link" &&
    /^(?:icon|manifest|apple-touch-icon)$/i.test(attrs.get("rel") ?? "")
  )
    names.push("href");
  return names;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
  if (node.content) walk(node.content, visit);
}

function findBaseHref(document) {
  let href = null;
  walk(document, (node) => {
    if (href != null || node.tagName?.toLowerCase() !== "base") return;
    href =
      node.attrs?.find((attribute) => attribute.name === "href")?.value ?? null;
  });
  return href;
}

function resolveDocumentUrl(request, htmlFilePath, root, baseHref) {
  if (!isLocalUrl(request)) return null;
  const htmlDirectory = path.dirname(htmlFilePath);
  let absolute;
  if (request.startsWith("/")) {
    absolute = path.resolve(root, `.${request}`);
  } else if (baseHref) {
    const basePath = baseHref.startsWith("/")
      ? path.resolve(root, `.${baseHref}`)
      : path.resolve(htmlDirectory, baseHref);
    const baseDirectory = baseHref.endsWith("/")
      ? basePath
      : path.dirname(basePath);
    absolute = path.resolve(baseDirectory, request);
  } else {
    absolute = path.resolve(htmlDirectory, request);
  }
  let relative = normalizePosixPath(path.relative(htmlDirectory, absolute));
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function normalizeDocumentRequest(request) {
  return normalizePosixPath(request);
}

function isLocalUrl(value) {
  return !/^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/|data:|blob:|#)/.test(value);
}

function shortHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}
