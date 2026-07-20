export default function workerThreadMetadataPlugin() {
  return {
    name: "worker-thread-metadata-plugin",
    transform: ["./worker-thread-metadata-transform.mjs"],
  };
}
