import { fileURLToPath } from "node:url";
import { WorkerPool } from "../dist/worker-pool.js";

const workerPath = fileURLToPath(
  new URL("./fixtures/worker-pool-worker.mjs", import.meta.url),
);

test("dispatches queued work in parallel without waiting for a cache miss", async () => {
  const pool = new WorkerPool({ workerPath, size: 4 });
  try {
    const warmResults = await Promise.all(
      Array.from({ length: 8 }, () => pool.run({ cacheHit: true, delay: 25 })),
    );
    expect(new Set(warmResults.map((result) => result.threadId)).size).toBe(4);
  } finally {
    await pool.close();
  }
});

test("removes a crashed worker and continues serving later work", async () => {
  const pool = new WorkerPool({ workerPath, size: 2, initialSize: 2 });
  try {
    await expect(pool.run({ crash: true })).rejects.toThrow(
      "Worker exited before completing its task",
    );
    const results = await Promise.all([
      pool.run({ cacheHit: false }),
      pool.run({ cacheHit: false }),
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.ok)).toBe(true);
  } finally {
    await pool.close();
  }
});

test("rejects active and queued work when the pool closes", async () => {
  const pool = new WorkerPool({ workerPath, size: 1 });
  const outcomes = Promise.allSettled([
    pool.run({ cacheHit: false, delay: 1_000 }),
    pool.run({ cacheHit: false, delay: 1_000 }),
  ]);

  await pool.close();

  expect(await outcomes).toEqual([
    expect.objectContaining({
      status: "rejected",
      reason: expect.objectContaining({
        message: "Worker pool closed before completing its task.",
      }),
    }),
    expect.objectContaining({
      status: "rejected",
      reason: expect.objectContaining({
        message: "Worker pool closed before completing its task.",
      }),
    }),
  ]);
});
