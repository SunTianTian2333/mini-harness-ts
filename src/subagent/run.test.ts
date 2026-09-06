import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ChatMessage } from "../runtime/types.js";
import { createMockAssistantTurn } from "./test-helpers.js";
import { runSubagent } from "./run.js";
import { SUB_MAX_TURNS, SUBAGENT_TIMEOUT_MESSAGE } from "./types.js";

describe("runSubagent", () => {
  it("uses a fresh messages array and returns final assistant text", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-run-"));
    await writeFile(join(cwd, "note.txt"), "vitest", "utf8");

    const externalMessages: ChatMessage[] = [{ role: "user", content: "parent" }];
    const snapshot = structuredClone(externalMessages);

    const result = await runSubagent("Summarize note.txt", cwd, {
      createAssistantTurn: createMockAssistantTurn([
        {
          toolCalls: [{ id: "call_read", name: "read_file", args: { path: "note.txt" } }],
        },
        { content: "The file says vitest." },
      ]),
    });

    assert.equal(result, "The file says vitest.");
    assert.deepEqual(externalMessages, snapshot);
  });

  it("returns timeout message when sub loop exceeds SUB_MAX_TURNS", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-timeout-"));
    const endlessToolCalls = Array.from({ length: SUB_MAX_TURNS + 1 }, (_, index) => ({
      toolCalls: [{ id: `call_${index}`, name: "glob", args: { pattern: "*.txt" } }],
    }));

    const result = await runSubagent("keep searching", cwd, {
      createAssistantTurn: createMockAssistantTurn(endlessToolCalls),
    });

    assert.equal(result, SUBAGENT_TIMEOUT_MESSAGE);
  });

  it("returns error string when the llm throws", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-llm-error-"));

    const result = await runSubagent("fail", cwd, {
      createAssistantTurn: async () => {
        throw new Error("api down");
      },
    });

    assert.equal(result, "Error: api down");
  });
});
