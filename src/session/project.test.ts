import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { projectToMessages } from "./project.js";
import type { SessionEventRecord } from "./types.js";

describe("projectToMessages", () => {
  it("rebuilds user, assistant, tool, and denied messages", () => {
    const events: SessionEventRecord[] = [
      {
        sessionId: "s1",
        seq: 1,
        eventType: "user/message",
        payload: { content: "hello" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        sessionId: "s1",
        seq: 2,
        eventType: "llm/response",
        payload: {
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "bash", arguments: "{\"command\":\"echo hi\"}" },
            },
          ],
        },
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        sessionId: "s1",
        seq: 3,
        eventType: "tool/result",
        payload: { id: "call_1", name: "bash", content: "hi" },
        createdAt: "2026-01-01T00:00:02.000Z",
      },
      {
        sessionId: "s1",
        seq: 4,
        eventType: "tool/denied",
        payload: { id: "call_2", reason: "Permission denied.", content: "Permission denied." },
        createdAt: "2026-01-01T00:00:03.000Z",
      },
      {
        sessionId: "s1",
        seq: 5,
        eventType: "session/end",
        payload: { reason: "quit" },
        createdAt: "2026-01-01T00:00:04.000Z",
      },
    ];

    const messages = projectToMessages(events);

    assert.equal(messages.length, 4);
    assert.deepEqual(messages[0], { role: "user", content: "hello" });
    assert.equal(messages[1]?.role, "assistant");
    assert.equal(messages[2]?.role, "tool");
    assert.equal((messages[2] as { content: string }).content, "hi");
    assert.equal((messages[3] as { tool_call_id: string }).tool_call_id, "call_2");
  });
});
