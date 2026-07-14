import { parentPort, threadId } from "node:worker_threads";

parentPort.on("message", ({ cacheHit, delay = 0 }) => {
  setTimeout(() => {
    parentPort.postMessage({ ok: true, cacheHit, threadId });
  }, delay);
});
