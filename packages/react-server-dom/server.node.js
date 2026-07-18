import * as upstream from "react-server-dom-webpack/server.node";
import {
  createClientImplementation as createImplementationDescriptor,
  registerClientImplementation,
} from "./implementation-registry.js";

export function createClientImplementation(chunks, exportName) {
  return createImplementationDescriptor(chunks, exportName);
}

const clientMetadata = new Map();
const inlineClientReferences = new Proxy(Object.create(null), {
  get(_target, id) {
    return typeof id === "string" ? clientMetadata.get(id) : undefined;
  },
});

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

export function renderToPipeableStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  return upstream.renderToPipeableStream(
    model,
    inlineClientReferences,
    readOptions(manifestOrOptions, explicitOptions),
  );
}

export function renderToReadableStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  return upstream.renderToReadableStream(
    model,
    inlineClientReferences,
    readOptions(manifestOrOptions, explicitOptions),
  );
}

export function prerender(model, manifestOrOptions, explicitOptions) {
  return upstream.prerender(
    model,
    inlineClientReferences,
    readOptions(manifestOrOptions, explicitOptions),
  );
}

export function prerenderToNodeStream(
  model,
  manifestOrOptions,
  explicitOptions,
) {
  return upstream.prerenderToNodeStream(
    model,
    inlineClientReferences,
    readOptions(manifestOrOptions, explicitOptions),
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
