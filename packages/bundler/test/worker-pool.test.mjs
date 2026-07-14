import { fileURLToPath } from "node:url";
import { WorkerPool } from "../dist/worker-pool.js";

const workerPath = fileURLToPath(
  new URL("./fixtures/worker-pool-worker.mjs", import.meta.url),
);

test("keeps fully cached work on one worker and expands after a miss", async () => {
  const pool = new WorkerPool({ workerPath, size: 4 });
  try {
    const warmResults = await Promise.all(
      Array.from({ length: 8 }, () => pool.run({ cacheHit: true })),
    );
    expect(new Set(warmResults.map((result) => result.threadId)).size).toBe(1);

    await pool.run({ cacheHit: false });
    const coldResults = await Promise.all(
      Array.from({ length: 8 }, () => pool.run({ cacheHit: false, delay: 25 })),
    );
    expect(new Set(coldResults.map((result) => result.threadId)).size).toBe(4);
  } finally {
    await pool.close();
  }
});
