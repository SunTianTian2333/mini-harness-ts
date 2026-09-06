import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runLoop } from "../agent/loop.js";
import { getBackgroundManager, shutdownBackgroundTasks } from "../background/manager.js";
import type { AssembledToolPool } from "../mcp/types.js";
import type { ChatMessage } from "../runtime/types.js";
import { createMockAssistantTurn } from "../subagent/test-helpers.js";
import { applyGoalGate } from "./gate.js";
import { resetGoalControllerForTests, setGoalEvaluatorForTests } from "./singleton.js";

describe("applyGoalGate", () => {
  beforeEach(() => {
    shutdownBackgroundTasks();
    getBackgroundManager().collect();
    resetGoalControllerForTests();
  });

  it("returns none when skipGoalGate is true", async () => {
    setGoalEvaluatorForTests({
      evaluate: async () => ({ ok: false, reason: "missing", impossible: false }),
    });
    const { getGoalController } = await import("./singleton.js");
    getGoalController().setGoal("tests pass");

    const outcome = await applyGoalGate([], "done", true);
    assert.deepEqual(outcome, { type: "none" });
  });

  it("continues on block with feedback message", async () => {
    setGoalEvaluatorForTests({
      evaluate: async () => ({ ok: false, reason: "no test output", impossible: false }),
    });
    const { getGoalController } = await import("./singleton.js");
    getGoalController().setGoal("tests pass");

    const messages: ChatMessage[] = [{ role: "assistant", content: "finished" }];
    const outcome = await applyGoalGate(messages, "finished", false);
    assert.equal(outcome.type, "continue");
    assert.match(String(messages.at(-1)?.content), /Goal still active/);
  });

  it("defers without evaluating when background is running", async () => {
    let evaluations = 0;
    setGoalEvaluatorForTests({
      evaluate: async () => {
        evaluations += 1;
        return { ok: true, reason: "should not run", impossible: false };
      },
    });
    const { getGoalController } = await import("./singleton.js");
    getGoalController().setGoal("tests pass");

    const cwd = mkdtempSync(join(tmpdir(), "goal-defer-"));
    getBackgroundManager().start("sleep 2", cwd, "tool-defer");

    const outcome = await applyGoalGate([], "waiting for background", false);
    assert.deepEqual(outcome, { type: "defer", text: "waiting for background" });
    assert.equal(evaluations, 0);
    assert.notEqual(getGoalController().active, null);
  });
});

describe("runLoop goal gate", () => {
  const emptyToolPool: AssembledToolPool = {
    tools: [],
    execute: async () => "",
  };

  beforeEach(() => {
    shutdownBackgroundTasks();
    getBackgroundManager().collect();
    resetGoalControllerForTests();
  });

  it("blocks stop until evaluator accepts completion", async () => {
    let evaluations = 0;
    setGoalEvaluatorForTests({
      evaluate: async () => {
        evaluations += 1;
        if (evaluations === 1) {
          return { ok: false, reason: "need npm test output", impossible: false };
        }
        return { ok: true, reason: "npm test passed", impossible: false };
      },
    });
    const { getGoalController } = await import("./singleton.js");
    getGoalController().setGoal("npm test passes");

    const messages: ChatMessage[] = [{ role: "user", content: "verify tests" }];
    const answer = await runLoop(messages, process.cwd(), "verify tests", {
      createAssistantTurn: createMockAssistantTurn([
        { content: "I ran tests." },
        { content: "Here is npm test output: all passed." },
      ]),
      buildSystemPrompt: async () => "test",
      toolPool: emptyToolPool,
    });
    assert.match(answer, /Goal achieved/);
    assert.match(answer, /npm test passed/);
  });

  it("returns after one turn when background defers goal evaluation", async () => {
    let llmCalls = 0;
    setGoalEvaluatorForTests({
      evaluate: async () => ({ ok: true, reason: "should not run", impossible: false }),
    });
    const { getGoalController } = await import("./singleton.js");
    getGoalController().setGoal("tests pass");

    const cwd = mkdtempSync(join(tmpdir(), "goal-defer-loop-"));
    getBackgroundManager().start("sleep 2", cwd, "tool-defer-loop");

    const messages: ChatMessage[] = [{ role: "user", content: "run tests" }];
    const answer = await runLoop(messages, cwd, "run tests", {
      createAssistantTurn: async () => {
        llmCalls += 1;
        return {
          message: { role: "assistant", content: "Started tests in background.", refusal: null },
          finishReason: "stop",
        };
      },
      buildSystemPrompt: async () => "test",
      toolPool: emptyToolPool,
    });

    assert.equal(llmCalls, 1);
    assert.equal(answer, "Started tests in background.");
    assert.notEqual(getGoalController().active, null);
  });

  it("returns limit message while keeping goal active", async () => {
    const previousCap = process.env.GOAL_BLOCK_CAP;
    process.env.GOAL_BLOCK_CAP = "1";
    resetGoalControllerForTests();
    setGoalEvaluatorForTests({
      evaluate: async () => ({ ok: false, reason: "still missing evidence", impossible: false }),
    });
    const { getGoalController } = await import("./singleton.js");
    const controller = getGoalController();
    controller.setGoal("npm test passes");

    const messages: ChatMessage[] = [{ role: "user", content: "verify tests" }];
    const answer = await runLoop(messages, process.cwd(), "verify tests", {
      createAssistantTurn: createMockAssistantTurn([
        { content: "I think tests passed." },
        { content: "Here is more detail without proof." },
      ]),
      buildSystemPrompt: async () => "test",
      toolPool: emptyToolPool,
    });

    assert.match(answer, /Goal limit/);
    assert.match(answer, /goal remains active/);
    assert.notEqual(controller.active, null);

    if (previousCap === undefined) {
      delete process.env.GOAL_BLOCK_CAP;
    } else {
      process.env.GOAL_BLOCK_CAP = previousCap;
    }
    resetGoalControllerForTests();
  });
});
