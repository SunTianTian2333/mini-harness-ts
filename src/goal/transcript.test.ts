import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { ChatMessage } from "../runtime/types.js";
import { transcriptText } from "./transcript.js";

describe("transcriptText", () => {
  it("renders roles and tool calls", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "run tests" },
      {
        role: "assistant",
        content: "running",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "bash", arguments: '{"command":"npm test"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "all passed" },
    ];

    const text = transcriptText(messages);
    assert.match(text, /USER:\nrun tests/);
    assert.match(text, /\[tool_call bash/);
    assert.match(text, /\[tool_result call_1\]/);
    assert.match(text, /all passed/);
  });

  it("trims oversized newest message", () => {
    const huge = "x".repeat(30_000);
    const text = transcriptText([{ role: "assistant", content: huge }], 1000);
    assert.ok(text.length <= 1000);
    assert.match(text, /\.\.\.\[middle omitted\]\.\.\./);
  });
});
