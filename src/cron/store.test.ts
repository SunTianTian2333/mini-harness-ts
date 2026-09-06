import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CronStore } from "./store.js";

describe("CronStore", () => {
  let cwd: string;

  beforeEach(() => {
    CronStore.resetForTests();
    cwd = mkdtempSync(join(tmpdir(), "cron-store-"));
  });

  it("schedules durable jobs to disk", () => {
    const store = CronStore.forCwd(cwd);
    const result = store.schedule("0 9 * * *", "run tests", true, true);
    assert.notEqual(typeof result, "string");
    if (typeof result === "string") {
      return;
    }
    assert.match(result.id, /^cron_[0-9a-f]{8}$/);
    assert.equal(existsSync(store.jobPath(result.id)), true);
  });

  it("cancels jobs and removes durable files", () => {
    const store = CronStore.forCwd(cwd);
    const job = store.schedule("0 9 * * *", "run tests", true, true);
    assert.notEqual(typeof job, "string");
    if (typeof job === "string") {
      return;
    }
    const message = store.cancel(job.id);
    assert.equal(message, `Cancelled ${job.id}`);
    assert.equal(existsSync(store.jobPath(job.id)), false);
  });

  it("acknowledges recurring and one-shot deliveries", () => {
    const store = CronStore.forCwd(cwd);
    const recurring = store.schedule("0 9 * * *", "daily", true, false);
    const once = store.schedule("0 9 * * *", "once", false, false);
    assert.notEqual(typeof recurring, "string");
    assert.notEqual(typeof once, "string");
    if (typeof recurring === "string" || typeof once === "string") {
      return;
    }

    store.markDue(recurring.id, "2026-09-06 09:00");
    store.markDue(once.id, "2026-09-06 09:00");
    assert.equal(store.get(recurring.id)?.pending_delivery, true);
    assert.equal(store.get(once.id)?.pending_delivery, true);

    store.ackDelivered(recurring.id);
    store.ackDelivered(once.id);
    assert.equal(store.get(recurring.id)?.pending_delivery, false);
    assert.equal(store.get(once.id), undefined);
  });

  it("reloads durable jobs from disk", () => {
    const store = CronStore.forCwd(cwd);
    const job = store.schedule("0 9 * * *", "persist me", true, true);
    assert.notEqual(typeof job, "string");
    if (typeof job === "string") {
      return;
    }

    CronStore.resetForTests();
    const reloaded = CronStore.forCwd(cwd);
    assert.equal(reloaded.get(job.id)?.prompt, "persist me");
    assert.match(readFileSync(reloaded.jobPath(job.id), "utf-8"), /persist me/);
  });
});
