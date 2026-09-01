import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { TodoReminderTracker } from "../todo/reminder.js";
import {
  clearHooks,
  registerHook,
  registerPostToolBatchHook,
  triggerHooks,
  triggerPostToolBatch,
  triggerSideEffectHooks,
} from "./registry.js";
import { reminderHook } from "./reminder.js";
import { checkDenyList } from "./permission.js";
import type { ToolCallBlock } from "./types.js";

describe("Hook registry", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("runs PreToolUse hooks in order until one blocks", async () => {
    const order: string[] = [];

    registerHook("PreToolUse", () => {
      order.push("first");
      return null;
    });
    registerHook("PreToolUse", () => {
      order.push("second");
      return "blocked";
    });
    registerHook("PreToolUse", () => {
      order.push("third");
      return null;
    });

    const block: ToolCallBlock = { id: "1", name: "bash", input: { command: "echo hi" } };
    const result = await triggerHooks("PreToolUse", block);

    assert.equal(result, "blocked");
    assert.deepEqual(order, ["first", "second"]);
  });

  it("PostToolUse hooks do not short-circuit", async () => {
    let count = 0;

    registerHook("PostToolUse", () => {
      count += 1;
      return "ignored";
    });
    registerHook("PostToolUse", () => {
      count += 1;
      return null;
    });

    const block: ToolCallBlock = { id: "1", name: "read_file", input: { path: "a.ts" } };
    await triggerSideEffectHooks("PostToolUse", block, "content");

    assert.equal(count, 2);
  });

  it("Stop hook can force loop to continue", async () => {
    registerHook("Stop", () => "continue please");

    const result = await triggerHooks("Stop", []);
    assert.equal(result, "continue please");
  });
});

describe("reminderHook", () => {
  it("appends reminder after three batches without todo_write", () => {
    const tracker = new TodoReminderTracker();
    const results = [{ id: "1", content: "ok" }];

    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    assert.equal(results[0]!.content, "ok");

    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    assert.match(results[0]!.content, /<reminder>Update your todos.<\/reminder>/);
  });

  it("resets counter when todo_write is used in batch", () => {
    const tracker = new TodoReminderTracker();
    const results = [{ id: "1", content: "ok" }];

    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    reminderHook({ results, usedTodo: true, todoReminder: tracker });
    reminderHook({ results, usedTodo: false, todoReminder: tracker });
    reminderHook({ results, usedTodo: false, todoReminder: tracker });

    assert.equal(results[0]!.content, "ok");
  });
});

describe("permissionHook helpers", () => {
  it("blocks deny list commands", () => {
    assert.match(checkDenyList("sudo rm -rf /") ?? "", /deny list/);
    assert.equal(checkDenyList("echo hello"), null);
  });
});

describe("PostToolBatch registry", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("runs all PostToolBatch hooks", async () => {
    const hits: string[] = [];
    registerPostToolBatchHook(() => {
      hits.push("a");
    });
    registerPostToolBatchHook(() => {
      hits.push("b");
    });

    await triggerPostToolBatch({
      results: [{ id: "1", content: "x" }],
      usedTodo: false,
      todoReminder: new TodoReminderTracker(),
    });

    assert.deepEqual(hits, ["a", "b"]);
  });
});
