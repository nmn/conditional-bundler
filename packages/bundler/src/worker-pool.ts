import path from "node:path";
import { Worker } from "node:worker_threads";

export type WorkerPoolOptions = {
  workerPath: string;
  size: number;
  initialSize?: number;
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
  private closed = false;

  constructor(private options: WorkerPoolOptions) {
    if (!Number.isInteger(options.size) || options.size < 1) {
      throw new Error("Worker pool size must be a positive integer.");
    }
    const initialSize = options.initialSize ?? 1;
    if (!Number.isInteger(initialSize) || initialSize < 1) {
      throw new Error("Worker pool initialSize must be a positive integer.");
    }
    this.ensureSize(initialSize);
  }

  run(
    payload: unknown,
    handleRequest?: (payload: unknown) => Promise<unknown>,
  ): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error("Worker pool is closed."));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, handleRequest, resolve, reject });
      this.drain();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const error = new Error("Worker pool closed before completing its task.");
    for (const task of this.queue.splice(0)) {
      task.reject(error);
    }
    const workers = [...this.workers];
    for (const worker of workers) {
      const current = (worker as Worker & { current?: WorkerTask }).current;
      if (current) {
        current.reject(error);
        (worker as Worker & { current?: WorkerTask }).current = undefined;
      }
    }
    this.workers.length = 0;
    this.idle.length = 0;
    await Promise.all(workers.map((worker) => worker.terminate()));
  }

  ensureSize(size: number): void {
    const desiredSize = Math.min(this.options.size, Math.max(1, size));
    while (!this.closed && this.workers.length < desiredSize) {
      this.createWorker();
    }
  }

  private drain(): void {
    const busyCount = this.workers.length - this.idle.length;
    this.ensureSize(busyCount + this.queue.length);
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
    this.workers = this.workers.filter((candidate) => candidate !== worker);
    this.idle = this.idle.filter((candidate) => candidate !== worker);
    this.drain();
  }

  private handleExit(this: WorkerPool, worker: Worker, code: number): void {
    if (
      !this.workers.includes(worker) &&
      !(worker as Worker & { current?: WorkerTask }).current
    ) {
      return;
    }
    this.handleError(
      worker,
      new Error(`Worker exited before completing its task (code ${code}).`),
    );
  }

  private createWorker(): void {
    const worker = new Worker(path.resolve(this.options.workerPath));
    worker.on("message", this.handleMessage.bind(this, worker));
    worker.on("error", this.handleError.bind(this, worker));
    worker.on("exit", this.handleExit.bind(this, worker));
    this.workers.push(worker);
    this.idle.push(worker);
  }
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
