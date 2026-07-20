import { parentPort, threadId } from "node:worker_threads";

parentPort.on("message", ({ cacheHit, delay = 0, crash = false }) => {
  if (crash) {
    process.exit(1);
  }
  setTimeout(() => {
    parentPort.postMessage({ ok: true, cacheHit, threadId });
  }, delay);
});
