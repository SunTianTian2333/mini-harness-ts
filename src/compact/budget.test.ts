import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import type { ChatMessage } from "../runtime/types.js";
import { findLatestToolBatch, toolResultBudget } from "./budget.js";
import {
  formatPersistedPreview,
  parsePersistedOutputPath,
  persistLargeToolOutput,
  saveToolOutput,
} from "./persist.js";
import { LARGE_RESULT_CHAR_LIMIT } from "./types.js";

function workspaceRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR);
}

describe("compact persist", () => {
  it("saves oversized tool output under .mini-harness/tool-results", () => {
    const root = mkdtempSync(join(tmpdir(), "compact-persist-"));
    mkdirSync(workspaceRoot(root), { recursive: true });
    const large = "x".repeat(LARGE_RESULT_CHAR_LIMIT + 100);

    const persisted = persistLargeToolOutput(root, "call-123", large);
    const savedPath = parsePersistedOutputPath(persisted);

    assert.ok(savedPath);
    assert.match(persisted, /<persisted-output>/);
    assert.equal(readFileSync(savedPath!, "utf-8").length, large.length);
  });

  it("rejects path escape in tool result filenames", () => {
    const root = mkdtempSync(join(tmpdir(), "compact-persist-"));
    assert.throws(() => saveToolOutput(root, "../escape", "data"), /Invalid tool result id/);
  });

  it("round-trips persisted preview paths", () => {
    const path = "/tmp/example/tool-results/call.txt";
    const formatted = formatPersistedPreview(path, "preview body");
    assert.equal(parsePersistedOutputPath(formatted), path);
  });
});

describe("toolResultBudget", () => {
  it("finds the latest consecutive tool batch", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "go" },
      { role: "assistant", content: "", tool_calls: [{ id: "a1", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "a1", content: "small" },
      { role: "assistant", content: "done" },
      { role: "user", content: "again" },
      { role: "assistant", content: "", tool_calls: [{ id: "b1", type: "function", function: { name: "bash", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "b1", content: "one" },
      { role: "tool", tool_call_id: "b2", content: "two" },
    ];

    assert.deepEqual(findLatestToolBatch(messages), { start: 6, end: 7 });
  });

  it("persists oversized results when the latest batch exceeds the budget", () => {
    const root = mkdtempSync(join(tmpdir(), "compact-budget-"));
    mkdirSync(workspaceRoot(root), { recursive: true });

    const hugeA = "a".repeat(LARGE_RESULT_CHAR_LIMIT + 500);
    const hugeB = "b".repeat(LARGE_RESULT_CHAR_LIMIT + 500);
    const messages: ChatMessage[] = [
      { role: "user", content: "read files" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "t1", type: "function", function: { name: "read_file", arguments: "{}" } },
          { id: "t2", type: "function", function: { name: "read_file", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "t1", content: hugeA },
      { role: "tool", tool_call_id: "t2", content: hugeB },
    ];

    toolResultBudget(messages, root, 30_000, LARGE_RESULT_CHAR_LIMIT);

    const first = messages[2]?.content;
    const second = messages[3]?.content;
    assert.equal(typeof first, "string");
    assert.equal(typeof second, "string");
    assert.match(String(first), /<persisted-output>/);
    assert.match(String(second), /<persisted-output>/);
    assert.ok(parsePersistedOutputPath(String(first)));
    assert.ok(parsePersistedOutputPath(String(second)));
  });
});
