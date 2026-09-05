import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BackgroundManager, getBackgroundManager } from "../background/manager.js";
import { EventQueue } from "./queue.js";
import { HarnessSession } from "./session.js";
import type { ChatMessage } from "../runtime/types.js";

describe("HarnessSession", () => {
  it("queues background events only while idle", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "harness-session-"));
    const history: ChatMessage[] = [];
    const queue = new EventQueue();
    const session = new HarnessSession(cwd, history, queue);
    const unbind = session.bindBackgroundEvents();
    const manager = getBackgroundManager();

    manager.start('echo "queued"', cwd, "tool-bg");
    await manager.waitUntilReady();

    assert.equal(session.isBusy(), false);
    assert.equal(queue.hasPending(), true);

    unbind();
    queue.close();
  });
});

describe("BackgroundManager.onReady", () => {
  it("notifies listeners when a task finishes", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "background-ready-"));
    const manager = new BackgroundManager();
    let readyCount = 0;
    const unbind = manager.onReady(() => {
      readyCount += 1;
    });

    manager.start('echo "ready"', cwd, "tool-ready");
    await manager.waitUntilReady();
    assert.equal(readyCount, 1);
    assert.equal(manager.hasReady(), true);

    unbind();
  });
});
