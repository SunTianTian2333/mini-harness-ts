import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import type { ChatMessage } from "../runtime/types.js";
import { estimateChars } from "./estimate.js";
import { microCompact } from "./micro.js";

function workspaceRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR);
}

describe("microCompact", () => {
  it("shortens older tool results while keeping the latest ones intact", () => {
    const root = mkdtempSync(join(tmpdir(), "compact-micro-"));
    mkdirSync(workspaceRoot(root), { recursive: true });

    const long = "z".repeat(200);
    const messages: ChatMessage[] = [
      { role: "user", content: "go" },
      { role: "assistant", content: "", tool_calls: [{ id: "a", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "a", content: long },
      { role: "assistant", content: "", tool_calls: [{ id: "b", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "b", content: long },
      { role: "assistant", content: "", tool_calls: [{ id: "c", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c", content: long },
      { role: "assistant", content: "", tool_calls: [{ id: "d", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "d", content: long },
      { role: "assistant", content: "", tool_calls: [{ id: "e", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "e", content: long },
      { role: "assistant", content: "", tool_calls: [{ id: "f", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "f", content: long },
    ];

    const before = estimateChars(messages);
    microCompact(messages, root, Math.floor(before * 0.5));

    assert.match(String(messages[2]?.content), /Earlier tool result saved at/);
    assert.equal(messages[12]?.content, long);
  });
});
