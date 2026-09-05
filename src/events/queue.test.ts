import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EventQueue } from "./queue.js";

describe("EventQueue", () => {
  it("delivers pushed events in order", async () => {
    const queue = new EventQueue();
    queue.push({ type: "user", query: "first" });
    queue.push({ type: "background" });

    assert.deepEqual(await queue.waitNext(), { type: "user", query: "first" });
    assert.deepEqual(await queue.waitNext(), { type: "background" });
  });

  it("resolves a waiting consumer when an event is pushed", async () => {
    const queue = new EventQueue();
    const next = queue.waitNext();
    queue.push({ type: "user", query: "hello" });
    assert.deepEqual(await next, { type: "user", query: "hello" });
  });

  it("rejects waiters when closed", async () => {
    const queue = new EventQueue();
    const pending = queue.waitNext();
    queue.close();
    await assert.rejects(pending, /closed/);
  });
});
