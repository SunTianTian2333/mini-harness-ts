import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCancelCron, runListCrons, runScheduleCron } from "../tools/cron.js";
import { CronStore } from "./store.js";

describe("cron tools", () => {
  beforeEach(() => {
    CronStore.resetForTests();
  });

  it("schedule_cron returns errors for invalid cron", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cron-tools-"));
    const output = runScheduleCron(cwd, "bad cron", "run tests");
    assert.match(output, /Error:/);
  });

  it("list_crons and cancel_cron manage scheduled jobs", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cron-tools-manage-"));
    const scheduled = runScheduleCron(cwd, "* * * * *", "run tests", false, false);
    assert.doesNotMatch(scheduled, /Error:/);
    const job = JSON.parse(scheduled) as { id: string };

    const listed = runListCrons(cwd);
    assert.match(listed, /run tests/);

    const cancelled = runCancelCron(cwd, job.id);
    assert.match(cancelled, /Cancelled/);
    assert.equal(runListCrons(cwd), "(no cron jobs)");
  });
});
