import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildSummaryMessage, isContextLengthError, summaryInput } from "./summarize.js";
import type { ChatMessage } from "../runtime/types.js";

describe("summarize", () => {
  it("truncates oversized summary input with head and tail", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "x".repeat(100_000) }];
    const input = summaryInput(messages);
    assert.match(input, /middle omitted/);
    assert.ok(input.length < 100_000);
  });

  it("builds compacted user message with active request", () => {
    const message = buildSummaryMessage("Compacted", "fix tests", "did work", "/tmp/t.jsonl");
    assert.match(String(message.content), /Current user request:\nfix tests/);
    assert.match(String(message.content), /Conversation summary/);
    assert.match(String(message.content), /Full transcript: \/tmp\/t.jsonl/);
  });

  it("detects context length errors", () => {
    assert.equal(isContextLengthError(new Error("prompt_too_long")), true);
    assert.equal(isContextLengthError(new Error("maximum context length exceeded")), true);
    assert.equal(isContextLengthError(new Error("network timeout")), false);
  });
});
