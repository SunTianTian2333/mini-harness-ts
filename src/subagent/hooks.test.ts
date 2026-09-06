import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { summaryHook } from "../hooks/summary.js";
import { clearHooks, registerHook } from "../hooks/registry.js";
import { setupDefaultHooks } from "../hooks/setup.js";
import { withSubagentContext } from "./context.js";
import { createMockAssistantTurn } from "./test-helpers.js";
import { runSubagent } from "./run.js";

describe("subagent hooks", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("summaryHook skips while subagent context is active", async () => {
    await withSubagentContext(async () => {
      assert.equal(
        summaryHook([{ role: "tool", content: "x", tool_call_id: "call_1" }]),
        null,
      );
    });
  });

  it("runs PreToolUse hooks for subagent tool calls", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "subagent-perm-"));
    setupDefaultHooks(cwd);

    let bashHookCalls = 0;
    registerHook("PreToolUse", (block) => {
      if (block && typeof block === "object" && "name" in block && block.name === "bash") {
        bashHookCalls += 1;
      }
      return null;
    });

    await runSubagent("probe", cwd, {
      createAssistantTurn: createMockAssistantTurn([
        { toolCalls: [{ id: "call_bash", name: "bash", args: { command: "echo ok" } }] },
        { content: "done" },
      ]),
    });

    assert.equal(bashHookCalls, 1);
  });
});
