import crypto from "node:crypto";

export default function transformRepresentation(context, options) {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(
    context.bytes,
  );
  const value = `${source.toUpperCase()}${options.suffix ?? ""}`;
  const outputId = `${context.canonicalPath}::uppercase:${context.environmentId}`;
  const secondaryOutputId = `${context.canonicalPath}::lowercase:${context.environmentId}`;
  const indexOutputId = `${context.canonicalPath}::index:${context.environmentId}`;
  const symbol = `__test_${crypto
    .createHash("sha1")
    .update(outputId)
    .digest("hex")
    .slice(0, 12)}_url`;
  const extraOutputs = {
    uppercase: {
      outputId,
      fileName: `custom/uppercase.${context.environmentId}.txt`,
      contentType: "text/plain; charset=utf-8",
      contents: value,
    },
    lowercase: {
      outputId: secondaryOutputId,
      fileName: `custom/lowercase.${context.environmentId}.txt`,
      contentType: "text/plain; charset=utf-8",
      contents: source.toLowerCase(),
    },
    index: {
      outputId: indexOutputId,
      fileName: `custom/index.${context.environmentId}.txt`,
      contentType: "text/plain; charset=utf-8",
      contents: "",
      template: {
        parts: [
          { kind: "text", value: "primary=" },
          {
            kind: "reference",
            referenceId: `${context.moduleIdentity}::index-primary`,
            encoding: "url",
          },
        ],
        references: [
          {
            id: `${context.moduleIdentity}::index-primary`,
            kind: "output-url",
            outputId,
            outputType: "plugin-resource",
            ownerId: context.moduleIdentity,
          },
        ],
      },
    },
  };
  if (options.mode === "missing") {
    delete extraOutputs.uppercase;
  } else if (options.mode === "conflict") {
    extraOutputs.conflict = {
      outputId,
      fileName: `custom/conflicting.${context.environmentId}.txt`,
      contentType: "text/plain; charset=utf-8",
      contents: "conflict",
    };
  }
  return {
    code: `export const environment = ${JSON.stringify(context.environmentId)};
export default ${symbol};`,
    extraOutputs,
    linkReferences: [
      {
        id: `${context.moduleIdentity}::primary-output`,
        kind: "output-url",
        outputId,
        outputType: "plugin-resource",
        symbol,
        ownerId: context.moduleIdentity,
      },
    ],
  };
}
