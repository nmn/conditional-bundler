import { threadId } from "node:worker_threads";

export default function workerThreadMetadataTransform() {
  return {
    name: "worker-thread-metadata-transform",
    visitor: {
      Program(_path, state) {
        state.file.metadata.conditionalBundlerExtraOutputs = {
          "test-worker-thread": {
            type: "test-worker-thread",
            metadata: { threadId },
          },
        };
      },
    },
  };
}
