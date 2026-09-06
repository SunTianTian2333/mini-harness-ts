import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EventQueue } from "../events/queue.js";
import { CronScheduler } from "./scheduler.js";
import { CronStore } from "./store.js";

describe("CronScheduler", () => {
  beforeEach(() => {
    CronStore.resetForTests();
  });

  it("enqueues due jobs once per minute marker", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cron-sched-"));
    const store = CronStore.forCwd(cwd);
    const queue = new EventQueue();
    const scheduler = new CronScheduler(store, queue);
    const job = store.schedule("* * * * *", "run tests", true, false);
    assert.notEqual(typeof job, "string");
    if (typeof job === "string") {
      return;
    }

    const moment = new Date(2026, 8, 6, 10, 0, 0);
    scheduler.pollOnce(moment);
    scheduler.pollOnce(moment);

    const event = await queue.waitNext();
    assert.equal(event.type, "cron");
    if (event.type === "cron") {
      assert.equal(event.jobId, job.id);
      assert.equal(event.prompt, "run tests");
    }
    assert.equal(queue.hasPending(), false);
    assert.equal(store.get(job.id)?.pending_delivery, true);
  });

  it("requeues pending jobs on startup", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cron-pending-"));
    const store = CronStore.forCwd(cwd);
    const job = store.schedule("0 9 * * *", "resume me", true, false);
    assert.notEqual(typeof job, "string");
    if (typeof job === "string") {
      return;
    }
    store.markDue(job.id, "2026-09-06 09:00");

    const queue = new EventQueue();
    const scheduler = new CronScheduler(store, queue);
    scheduler.requeuePending();

    const event = await queue.waitNext();
    assert.equal(event.type, "cron");
    queue.close();
  });
});
