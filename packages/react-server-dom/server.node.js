import * as upstream from "react-server-dom-webpack/server.node";
import {
  createClientImplementation as createImplementationDescriptor,
  registerClientImplementation,
} from "./implementation-registry.js";

export function createClientImplementation(chunks, exportName) {
  return createImplementationDescriptor(chunks, exportName);
}

const clientMetadata = new Map();
function createInlineClientReferences(mapClientChunk) {
  return new Proxy(Object.create(null), {
    get(_target, id) {
      if (typeof id !== "string") return undefined;
      const metadata = clientMetadata.get(id);
      if (!metadata || typeof mapClientChunk !== "function") return metadata;
      return {
        ...metadata,
        chunks: metadata.chunks.map(mapClientChunk),
      };
    },
  });
}

export function registerClientReference(
  implementation,
  id,
  exportName,
  chunks,
) {
  if (!Array.isArray(chunks) || chunks.some((url) => typeof url !== "string")) {
    throw new TypeError("Client Reference chunks must be an array of URLs.");
  }
  registerClientImplementation(id, exportName, implementation);
  clientMetadata.set(`${id}#${exportName}`, {
    id,
    name: exportName,
    chunks: [...chunks],
    async: false,
  });
  return upstream.registerClientReference(implementation, id, exportName);
}

function readOptions(manifestOrOptions, explicitOptions) {
  if (explicitOptions !== undefined) return explicitOptions;
  if (
    manifestOrOptions &&
    typeof manifestOrOptions === "object" &&
    !Array.isArray(manifestOrOptions)
  ) {
    return manifestOrOptions;
  }
  return undefined;
}

function readRenderConfiguration(manifestOrOptions, explicitOptions) {
  const options = readOptions(manifestOrOptions, explicitOptions);
  if (!options || typeof options.mapClientChunk !== "function") {
    return {
      manifest: createInlineClientReferences(),
      options,
    };
  }
  const { mapClientChunk, ...upstreamOptions } = options;
  return {
    manifest: createInlineClientReferences(mapClientChunk),
    options: upstreamOptions,
  };
}

export function renderToPipeableStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  const configuration = readRenderConfiguration(
    manifestOrOptions,
    explicitOptions,
  );
  return upstream.renderToPipeableStream(
    model,
    configuration.manifest,
    configuration.options,
  );
}

export function renderToReadableStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  const configuration = readRenderConfiguration(
    manifestOrOptions,
    explicitOptions,
  );
  return upstream.renderToReadableStream(
    model,
    configuration.manifest,
    configuration.options,
  );
}

export function prerender(model, manifestOrOptions, explicitOptions) {
  const configuration = readRenderConfiguration(
    manifestOrOptions,
    explicitOptions,
  );
  return upstream.prerender(
    model,
    configuration.manifest,
    configuration.options,
  );
}

export function prerenderToNodeStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  const configuration = readRenderConfiguration(
    manifestOrOptions,
    explicitOptions,
  );
  return upstream.prerenderToNodeStream(
    model,
    configuration.manifest,
    configuration.options,
  );
}

export const decodeReply = upstream.decodeReply;
export const decodeReplyFromBusboy = upstream.decodeReplyFromBusboy;
export const decodeReplyFromAsyncIterable =
  upstream.decodeReplyFromAsyncIterable;
export const decodeAction = upstream.decodeAction;
export const decodeFormState = upstream.decodeFormState;
export const registerServerReference = upstream.registerServerReference;
export const createClientModuleProxy = upstream.createClientModuleProxy;
export const createTemporaryReferenceSet = upstream.createTemporaryReferenceSet;
