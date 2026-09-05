import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import { canStart, claimTask, completeTask } from "./logic.js";
import { TaskStore } from "./store.js";

function tasksRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR, "tasks");
}

describe("TaskStore", () => {
  it("creates, loads, lists, and updates dependencies", () => {
    const root = mkdtempSync(join(tmpdir(), "task-store-"));
    mkdirSync(tasksRoot(root), { recursive: true });
    const store = new TaskStore(tasksRoot(root));

    const first = store.create("Schema", "Define schema");
    const second = store.create("API", "Build API");
    assert.match(first.id, /^task_[0-9a-f]{8}$/);
    assert.equal(store.list().length, 2);

    const updated = store.updateDependencies(second.id, [first.id]);
    assert.deepEqual(updated.blockedBy, [first.id]);
    assert.equal(canStart(store, first.id), true);
    assert.equal(canStart(store, second.id), false);
  });

  it("rejects dependency cycles and self dependencies", () => {
    const root = mkdtempSync(join(tmpdir(), "task-store-"));
    mkdirSync(tasksRoot(root), { recursive: true });
    const store = new TaskStore(tasksRoot(root));

    const a = store.create("A");
    const b = store.create("B");
    store.updateDependencies(b.id, [a.id]);

    assert.throws(() => store.updateDependencies(a.id, [b.id]), /cycle detected/);
    assert.throws(() => store.updateDependencies(a.id, [a.id]), /depend on itself/);
  });

  it("rejects path escape in task IDs", () => {
    const root = mkdtempSync(join(tmpdir(), "task-store-"));
    const store = new TaskStore(tasksRoot(root));
    assert.throws(() => store.taskPath("../outside.json"), /Invalid task ID/);
  });
});

describe("task lifecycle", () => {
  it("claims, completes, and unblocks downstream tasks", () => {
    const root = mkdtempSync(join(tmpdir(), "task-store-"));
    mkdirSync(tasksRoot(root), { recursive: true });
    const store = new TaskStore(tasksRoot(root));

    const schema = store.create("Schema");
    const api = store.create("API");
    const tests = store.create("Tests");
    store.updateDependencies(api.id, [schema.id]);
    store.updateDependencies(tests.id, [api.id]);

    assert.match(claimTask(store, api.id), /Blocked by/);
    assert.match(claimTask(store, schema.id), /Claimed/);
    assert.match(completeTask(store, schema.id), /Completed/);

    assert.match(claimTask(store, api.id), /Claimed/);
    assert.match(completeTask(store, api.id), /Unblocked: Tests/);

    assert.match(claimTask(store, tests.id), /Claimed/);
    assert.match(completeTask(store, tests.id), /Completed/);
  });

  it("rejects completing tasks not owned by the agent", () => {
    const root = mkdtempSync(join(tmpdir(), "task-store-"));
    mkdirSync(tasksRoot(root), { recursive: true });
    const store = new TaskStore(tasksRoot(root));

    const task = store.create("Solo");
    claimTask(store, task.id, "other-agent");
    assert.match(completeTask(store, task.id), /owned by other-agent/);
  });
});
