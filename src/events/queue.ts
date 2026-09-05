import type { HarnessEvent } from "./types.js";

type QueueWaiter = {
  resolve: (event: HarnessEvent) => void;
  reject: (error: Error) => void;
};

export class EventQueue {
  private readonly pending: HarnessEvent[] = [];
  private waiters: QueueWaiter[] = [];
  private closed = false;

  push(event: HarnessEvent): void {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(event);
      return;
    }
    this.pending.push(event);
  }

  waitNext(): Promise<HarnessEvent> {
    if (this.closed) {
      return Promise.reject(new Error("EventQueue is closed"));
    }
    const event = this.pending.shift();
    if (event) {
      return Promise.resolve(event);
    }
    return new Promise<HarnessEvent>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  hasPending(): boolean {
    return this.pending.length > 0;
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const error = new Error("EventQueue is closed");
    for (const waiter of this.waiters) {
      waiter.reject(error);
    }
    this.waiters = [];
  }
}
