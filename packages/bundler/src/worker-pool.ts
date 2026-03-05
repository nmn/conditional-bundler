import path from "node:path";
import { Worker } from "node:worker_threads";

export type WorkerPoolOptions = {
  workerPath: string;
  size: number;
};

type WorkerTask = {
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class WorkerPool {
  private queue: WorkerTask[] = [];
  private workers: Worker[] = [];
  private idle: Worker[] = [];

  constructor(private options: WorkerPoolOptions) {
    for (let i = 0; i < options.size; i += 1) {
      const worker = new Worker(path.resolve(options.workerPath));
      worker.on("message", this.handleMessage.bind(this, worker));
      worker.on("error", this.handleError.bind(this, worker));
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  run(payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, resolve, reject });
      this.drain();
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }

  private drain(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.shift();
      const task = this.queue.shift();
      if (!worker || !task) {
        return;
      }
      (worker as Worker & { current?: WorkerTask }).current = task;
      worker.postMessage(task.payload);
    }
  }

  private handleMessage(
    this: WorkerPool,
    worker: Worker,
    message: unknown,
  ): void {
    const current = (worker as Worker & { current?: WorkerTask }).current;
    if (current) {
      const payload = message as { ok?: boolean; error?: string };
      if (payload && payload.ok === false) {
        current.reject(new Error(payload.error ?? "Worker error"));
      } else {
        current.resolve(message);
      }
      (worker as Worker & { current?: WorkerTask }).current = undefined;
      this.idle.push(worker);
      this.drain();
    }
  }

  private handleError(this: WorkerPool, worker: Worker, error: Error): void {
    const current = (worker as Worker & { current?: WorkerTask }).current;
    if (current) {
      current.reject(error);
      (worker as Worker & { current?: WorkerTask }).current = undefined;
    }
    this.idle.push(worker);
    this.drain();
  }
}
