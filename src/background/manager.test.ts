import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BackgroundManager, getBackgroundManager } from "./manager.js";
import { injectBackgroundResults } from "./inject.js";
import type { ChatMessage } from "../runtime/types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCollect(
  manager: BackgroundManager,
  timeoutMs = 5_000,
): Promise<ReturnType<BackgroundManager["collect"]>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const collected = manager.collect();
    if (collected.length > 0) {
      return collected;
    }
    await sleep(50);
  }
  return manager.collect();
}

describe("BackgroundManager", () => {
  it("starts a task and collects completed output", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "background-"));
    const manager = new BackgroundManager();

    const taskId = manager.start('sleep 0.1 && echo "bg-ok"', cwd, "tool-1");
    assert.match(taskId, /^bg_\d{4}$/);

    const collected = await waitForCollect(manager);
    assert.equal(collected.length, 1);
    assert.equal(collected[0]?.taskId, taskId);
    assert.equal(collected[0]?.task.status, "completed");
    assert.match(collected[0]?.summary ?? "", /bg-ok/);
  });

  it("marks non-zero exit as failed", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "background-"));
    const manager = new BackgroundManager();

    manager.start("exit 3", cwd, "tool-2");
    const collected = await waitForCollect(manager);
    assert.equal(collected[0]?.task.status, "failed");
    assert.match(collected[0]?.summary ?? "", /exited with status 3/);
  });

  it("rejects empty commands", () => {
    const manager = new BackgroundManager();
    assert.throws(() => manager.start("   ", "/tmp", "tool-3"), /cannot be empty/);
  });

  it("returns empty when collect has no ready tasks", () => {
    const manager = new BackgroundManager();
    assert.deepEqual(manager.collect(), []);
  });
});

describe("injectBackgroundResults", () => {
  it("appends notifications to the latest user message", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "background-inject-"));
    const manager = getBackgroundManager();
    manager.start('echo "fresh"', cwd, "tool-6");
    await manager.waitUntilReady();

    const messages: ChatMessage[] = [{ role: "user", content: "keep me" }];
    const count = injectBackgroundResults(messages);
    assert.equal(count, 1);
    assert.match(String(messages[0]?.content), /\[Background completed\]/);
    assert.match(String(messages[0]?.content), /task_notification/);
    assert.match(String(messages[0]?.content), /keep me/);
  });
});
