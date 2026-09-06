import type { EventQueue } from "../events/queue.js";
import { cronMatches, minuteMarker } from "./match.js";
import type { CronStore } from "./store.js";

export class CronScheduler {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: CronStore,
    private readonly queue: EventQueue,
  ) {}

  start(intervalMs = 1000): void {
    if (this.timer) {
      return;
    }
    this.requeuePending();
    this.timer = setInterval(() => {
      this.pollOnce(new Date());
    }, intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  requeuePending(): void {
    for (const job of this.store.pendingJobs()) {
      this.queue.push({ type: "cron", jobId: job.id, prompt: job.prompt });
    }
  }

  pollOnce(moment: Date): void {
    const marker = minuteMarker(moment);

    for (const job of this.store.list()) {
      try {
        if (job.pending_delivery || job.last_fired === marker) {
          continue;
        }
        if (!cronMatches(job.cron, moment)) {
          continue;
        }
        const due = this.store.markDue(job.id, marker);
        process.stdout.write(`  [cron] due ${due.id}: ${due.prompt.slice(0, 60)}\n`);
        this.queue.push({ type: "cron", jobId: due.id, prompt: due.prompt });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(`  [cron] could not enqueue ${job.id}: ${message}\n`);
      }
    }
  }
}
