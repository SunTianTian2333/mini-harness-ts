import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assembleToolPool } from "../mcp/registry.js";
import { runToolBatch } from "../agent/tool-batch.js";
import { clearHooks } from "../hooks/registry.js";
import { createMemoryExtractHook } from "../hooks/memory-extract.js";
import { setupDefaultHooks } from "../hooks/setup.js";
import { generateSessionId } from "../session/id.js";
import { SessionDatabase } from "../session/sqlite.js";
import { createNewSessionStore } from "../session/store.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import { withSubagentContext } from "./context.js";
import { createMockAssistantTurn } from "./test-helpers.js";
import { runSubagent } from "./run.js";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { ChatMessage } from "../runtime/types.js";

describe("subagent integration", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("parent conversation only receives the final subagent text via run_subagent tool", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-int-"));
    await writeFile(join(cwd, "framework.txt"), "vitest", "utf8");

    const parentMessages: ChatMessage[] = [{ role: "user", content: "find test framework" }];
    const parentLength = parentMessages.length;

    const pool = assembleToolPool();
    const toolCalls: ChatCompletionMessageToolCall[] = [
      {
        id: "call_delegate",
        type: "function",
        function: {
          name: "run_subagent",
          arguments: JSON.stringify({ prompt: "Read framework.txt and answer with the framework name only." }),
        },
      },
    ];

    const mockLlm = createMockAssistantTurn([
      {
        toolCalls: [{ id: "sub_read", name: "read_file", args: { path: "framework.txt" } }],
      },
      { content: "vitest" },
    ]);

    pool.execute = async (name, args, executeCwd) => {
      if (name === "run_subagent") {
        return runSubagent(String(args.prompt), executeCwd, { createAssistantTurn: mockLlm });
      }
      return assembleToolPool().execute(name, args, executeCwd);
    };

    const { results } = await runToolBatch(toolCalls, cwd, new TodoReminderTracker(), pool.execute);

    parentMessages.push({
      role: "assistant",
      content: "",
      tool_calls: toolCalls,
    });
    for (const result of results) {
      parentMessages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }

    assert.equal(results[0]?.content, "vitest");
    assert.equal(parentMessages.length, parentLength + 2);
    assert.equal(parentMessages.filter((message) => message.role === "tool").length, 1);
  });

  it("skips memory extract while subagent context is active", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-mem-"));
    const hook = createMemoryExtractHook(cwd);
    const messages: ChatMessage[] = [
      { role: "user", content: "remember I prefer vitest" },
      { role: "assistant", content: "ok" },
    ];

    await withSubagentContext(async () => {
      const result = await hook(messages);
      assert.equal(result, null);
    });
  });

  it("does not write subagent tool events into session log", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-session-"));
    const db = new SessionDatabase(":memory:");
    const sessionId = generateSessionId();
    const store = createNewSessionStore(db, cwd, "test-model", sessionId);
    setupDefaultHooks(cwd, store);

    await runSubagent("Say hello", cwd, {
      createAssistantTurn: createMockAssistantTurn([{ content: "hello" }]),
    });

    const toolStarts = db.loadEvents(sessionId).filter((event) => event.eventType === "tool/start");
    assert.equal(toolStarts.length, 0);
    db.close();
  });
});
