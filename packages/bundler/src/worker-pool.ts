import path from "node:path";
import { Worker } from "node:worker_threads";

export type WorkerPoolOptions = {
  workerPath: string;
  size: number;
};

type WorkerTask = {
  payload: unknown;
  handleRequest?: (payload: unknown) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type WorkerRequestMessage = {
  type: "coordinator-request";
  requestId: number;
  payload: unknown;
};

export class WorkerPool {
  private queue: WorkerTask[] = [];
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private parallelismEnabled: boolean;

  constructor(private options: WorkerPoolOptions) {
    if (!Number.isInteger(options.size) || options.size < 1) {
      throw new Error("Worker pool size must be a positive integer.");
    }
    this.parallelismEnabled = options.size === 1;
    this.createWorker();
  }

  run(
    payload: unknown,
    handleRequest?: (payload: unknown) => Promise<unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, handleRequest, resolve, reject });
      this.drain();
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }

  private drain(): void {
    if (this.parallelismEnabled) {
      const busyCount = this.workers.length - this.idle.length;
      const desiredSize = Math.min(
        this.options.size,
        busyCount + this.queue.length,
      );
      while (this.workers.length < desiredSize) {
        this.createWorker();
      }
    }
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
      if (isWorkerRequestMessage(message)) {
        void this.handleWorkerRequest(worker, current, message);
        return;
      }
      const payload = message as { ok?: boolean; error?: string };
      if (payload && payload.ok === false) {
        current.reject(new Error(payload.error ?? "Worker error"));
      } else {
        if (isCacheMiss(payload)) {
          this.parallelismEnabled = true;
          while (this.workers.length < this.options.size) {
            this.createWorker();
          }
        }
        current.resolve(message);
      }
      (worker as Worker & { current?: WorkerTask }).current = undefined;
      this.idle.push(worker);
      this.drain();
    }
  }

  private async handleWorkerRequest(
    worker: Worker,
    task: WorkerTask,
    message: WorkerRequestMessage,
  ): Promise<void> {
    try {
      if (!task.handleRequest) {
        throw new Error(
          "Worker task requested coordinator work without a handler.",
        );
      }
      const payload = await task.handleRequest(message.payload);
      worker.postMessage({
        type: "coordinator-response",
        requestId: message.requestId,
        payload,
      });
    } catch (error) {
      worker.postMessage({
        type: "coordinator-response",
        requestId: message.requestId,
        error: (error as Error).message,
      });
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

  private createWorker(): void {
    const worker = new Worker(path.resolve(this.options.workerPath));
    worker.on("message", this.handleMessage.bind(this, worker));
    worker.on("error", this.handleError.bind(this, worker));
    this.workers.push(worker);
    this.idle.push(worker);
  }
}

function isCacheMiss(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { ok?: unknown }).ok === true &&
    (payload as { cacheHit?: unknown }).cacheHit === false
  );
}

function isWorkerRequestMessage(
  message: unknown,
): message is WorkerRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "coordinator-request" &&
    typeof (message as { requestId?: unknown }).requestId === "number"
  );
}
