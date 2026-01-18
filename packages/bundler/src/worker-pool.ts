import path from "node:path";
import { Worker } from "node:worker_threads";

export type WorkerPoolOptions = {
  workerPath: string;
  size: number;
};

export class WorkerPool {
  private queue: Array<{
    payload: unknown;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private workers: Worker[] = [];
  private idle: Worker[] = [];

  constructor(private options: WorkerPoolOptions) {
    for (let i = 0; i < options.size; i += 1) {
      const worker = new Worker(path.resolve(options.workerPath));
      worker.on("message", (message) => this.handleMessage(worker, message));
      worker.on("error", (error) => this.handleError(worker, error));
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

  private drain(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.shift();
      const task = this.queue.shift();
      if (!worker || !task) {
        return;
      }
      (worker as Worker & { current?: typeof task }).current = task;
      worker.postMessage(task.payload);
    }
  }

  private handleMessage(worker: Worker, message: unknown): void {
    const current = (worker as Worker & { current?: typeof this.queue[0] }).current;
    if (current) {
      current.resolve(message);
      (worker as Worker & { current?: typeof this.queue[0] }).current = undefined;
      this.idle.push(worker);
      this.drain();
    }
  }

  private handleError(worker: Worker, error: Error): void {
    const current = (worker as Worker & { current?: typeof this.queue[0] }).current;
    if (current) {
      current.reject(error);
      (worker as Worker & { current?: typeof this.queue[0] }).current = undefined;
    }
    this.idle.push(worker);
    this.drain();
  }
}
