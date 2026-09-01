import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import type { ChatMessage } from "../runtime/types.js";
import { isArchiveMarker, snipCompact } from "./snip.js";

function workspaceRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR);
}

function assistantWithTools(id: string): ChatMessage {
  return {
    role: "assistant",
    content: "",
    tool_calls: [{ id, type: "function", function: { name: "bash", arguments: "{}" } }],
  };
}

describe("snipCompact", () => {
  it("returns messages unchanged when under the limit", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
    assert.deepEqual(snipCompact(messages, "/tmp"), messages);
  });

  it("archives the middle and preserves assistant/tool pairs at boundaries", () => {
    const root = mkdtempSync(join(tmpdir(), "compact-snip-"));
    mkdirSync(workspaceRoot(root), { recursive: true });

    const messages: ChatMessage[] = [
      { role: "user", content: "head" },
      ...Array.from({ length: 49 }, (_, index) => ({
        role: "user" as const,
        content: `fill-${index}`,
      })),
      assistantWithTools("tail-call"),
      { role: "tool", tool_call_id: "tail-call", content: "tail-result" },
    ];

    const compacted = snipCompact(messages, root);
    assert.ok(compacted.length <= 50);
    assert.equal(compacted.at(-1)?.role, "tool");
    assert.equal(compacted.at(-2)?.role, "assistant");
    assert.ok(compacted.some(isArchiveMarker));

    const marker = compacted.find(isArchiveMarker);
    const transcriptPath = String(marker?.content).match(/archived at (.+)\]$/)?.[1];
    assert.ok(transcriptPath);
    assert.ok(readFileSync(transcriptPath!, "utf-8").includes("fill-0"));
  });
});
