import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ComputerAction, ComputerActionResult } from '@bytebot/shared';

interface PendingRequest {
  clientId?: string;
  resolve: (value: ComputerActionResult) => void;
  reject: (reason?: any) => void;
}

export interface ComputerActionJob {
  id: string;
  action: ComputerAction;
  clientId?: string;
}

@Injectable()
export class ComputerUseCommandQueue {
  private readonly logger = new Logger(ComputerUseCommandQueue.name);
  private queue: ComputerActionJob[] = [];
  private readonly waiters: ((job: ComputerActionJob | null) => void)[] = [];
  private readonly pending = new Map<string, PendingRequest>();
  private readonly jobs = new Map<string, ComputerActionJob>();
  private shuttingDown = false;

  enqueue(
    action: ComputerAction,
    options: { clientId?: string; requestId?: string } = {},
  ): { id: string; result: Promise<ComputerActionResult> } {
    if (this.shuttingDown) {
      throw new Error('Computer use command queue has been shut down');
    }

    const id = options.requestId ?? randomUUID();

    if (this.pending.has(id)) {
      throw new Error(`Duplicate computer action request id: ${id}`);
    }

    const job: ComputerActionJob = {
      id,
      action,
      clientId: options.clientId,
    };

    const deferred = this.createDeferred<ComputerActionResult>();

    this.pending.set(id, {
      clientId: options.clientId,
      resolve: deferred.resolve,
      reject: deferred.reject,
    });
    this.jobs.set(id, job);

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(job);
    } else {
      this.queue.push(job);
    }

    return { id, result: deferred.promise };
  }

  async next(): Promise<ComputerActionJob | null> {
    if (this.queue.length > 0) {
      return this.queue.shift() ?? null;
    }

    if (this.shuttingDown) {
      return null;
    }

    return new Promise<ComputerActionJob | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  completeSuccess(id: string, data: unknown): void {
    const job = this.jobs.get(id);
    const pending = this.pending.get(id);

    if (!job || !pending) {
      if (!job) {
        this.logger.warn(`No queued job found for success result ${id}`);
      }
      return;
    }

    pending.resolve({
      id,
      action: job.action.action,
      status: 'ok',
      data,
    });

    this.pending.delete(id);
    this.jobs.delete(id);
  }

  completeError(id: string, error: Error): void {
    const job = this.jobs.get(id);
    const pending = this.pending.get(id);

    if (!job || !pending) {
      if (!job) {
        this.logger.warn(`No queued job found for error result ${id}`);
      }
      return;
    }

    pending.resolve({
      id,
      action: job.action.action,
      status: 'error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    this.pending.delete(id);
    this.jobs.delete(id);
  }

  clearClient(clientId: string): void {
    const disconnectError = new Error('Client disconnected');

    const remainingQueue: ComputerActionJob[] = [];
    for (const job of this.queue) {
      if (job.clientId === clientId) {
        this.fail(job.id, disconnectError);
      } else {
        remainingQueue.push(job);
      }
    }
    this.queue = remainingQueue;

    for (const [id, pending] of this.pending.entries()) {
      if (pending.clientId === clientId) {
        this.fail(id, disconnectError);
      }
    }
  }

  shutdown(reason?: string): void {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    const shutdownError = new Error(
      reason ?? 'Computer use command queue shutting down',
    );

    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(null);
    }

    for (const id of Array.from(this.pending.keys())) {
      this.fail(id, shutdownError);
    }

    this.queue = [];
    this.jobs.clear();
  }

  private fail(id: string, error: Error): void {
    const job = this.jobs.get(id);
    const pending = this.pending.get(id);

    if (!job || !pending) {
      return;
    }

    pending.reject(error);
    this.pending.delete(id);
    this.jobs.delete(id);
  }

  private createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: any) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  }
}
