import * as upstream from "react-server-dom-webpack/client.node";

const inlineConsumer = {
  moduleMap: null,
  serverModuleMap: null,
  moduleLoading: null,
};

export function createFromNodeStream(stream, options) {
  return upstream.createFromNodeStream(stream, inlineConsumer, options);
}

export const createFromFetch = upstream.createFromFetch;
export const createFromReadableStream = upstream.createFromReadableStream;
export const createServerReference = upstream.createServerReference;
export const createTemporaryReferenceSet = upstream.createTemporaryReferenceSet;
export const encodeReply = upstream.encodeReply;
export const registerServerReference = upstream.registerServerReference;
