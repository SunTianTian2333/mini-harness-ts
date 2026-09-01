import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { clearHooks } from "../hooks/registry.js";
import { setupDefaultHooks } from "../hooks/setup.js";
import { generateSessionId } from "../session/id.js";
import { SessionDatabase } from "../session/sqlite.js";
import { createNewSessionStore } from "../session/store.js";
import type { SessionEventType } from "../session/types.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import { runToolBatch } from "./tool-batch.js";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

const WORKDIR = "/tmp/work";

function createSessionHarness(): { db: SessionDatabase; sessionId: string } {
  const db = new SessionDatabase(":memory:");
  const sessionId = generateSessionId();
  const store = createNewSessionStore(db, WORKDIR, "test-model", sessionId);
  setupDefaultHooks(WORKDIR, store);
  return { db, sessionId };
}

function countEvents(db: SessionDatabase, sessionId: string, eventType: SessionEventType): number {
  return db.loadEvents(sessionId).filter((event) => event.eventType === eventType).length;
}

describe("runToolBatch", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("logs tool/denied when tool arguments are invalid JSON", async () => {
    const { db, sessionId } = createSessionHarness();

    const toolCalls: ChatCompletionMessageToolCall[] = [
      {
        id: "call_bad_json",
        type: "function",
        function: {
          name: "bash",
          arguments: "not-json",
        },
      },
    ];

    const results = await runToolBatch(toolCalls, WORKDIR, new TodoReminderTracker());

    assert.match(results[0]?.content ?? "", /invalid tool arguments JSON/);

    const denied = db.loadEvents(sessionId).filter((event) => event.eventType === "tool/denied");
    assert.equal(denied.length, 1);
    assert.equal(denied[0]?.payload.reason, "Error: invalid tool arguments JSON");
    assert.equal(denied[0]?.payload.name, "bash");
    assert.equal(countEvents(db, sessionId, "tool/start"), 0);
    assert.equal(countEvents(db, sessionId, "tool/result"), 0);

    db.close();
  });

  it("logs tool/denied when permission deny list blocks bash", async () => {
    const { db, sessionId } = createSessionHarness();

    const toolCalls: ChatCompletionMessageToolCall[] = [
      {
        id: "call_denied",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "sudo ls" }),
        },
      },
    ];

    const results = await runToolBatch(toolCalls, WORKDIR, new TodoReminderTracker());

    assert.equal(results[0]?.content, "Permission denied.");

    const denied = db.loadEvents(sessionId).filter((event) => event.eventType === "tool/denied");
    assert.equal(denied.length, 1);
    assert.equal(denied[0]?.payload.reason, "Permission denied.");
    assert.equal(denied[0]?.payload.name, "bash");
    assert.equal(denied[0]?.payload.id, "call_denied");
    assert.equal(countEvents(db, sessionId, "tool/start"), 0);
    assert.equal(countEvents(db, sessionId, "tool/result"), 0);

    db.close();
  });

  it("does not log tool/start or tool/result when permission blocks before execution", async () => {
    const { db, sessionId } = createSessionHarness();

    await runToolBatch(
      [
        {
          id: "call_rm",
          type: "function",
          function: {
            name: "bash",
            arguments: JSON.stringify({ command: "rm -rf /" }),
          },
        },
      ],
      WORKDIR,
      new TodoReminderTracker(),
    );

    assert.equal(countEvents(db, sessionId, "tool/denied"), 1);
    assert.equal(countEvents(db, sessionId, "tool/start"), 0);
    assert.equal(countEvents(db, sessionId, "tool/result"), 0);

    db.close();
  });
});
