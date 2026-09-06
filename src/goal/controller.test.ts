import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { GoalController, type GoalEvaluator } from "./controller.js";
import type { ChatMessage } from "../runtime/types.js";

function mockEvaluator(result: import("./types.js").GoalEvaluation): GoalEvaluator {
  return {
    evaluate: async () => result,
  };
}

describe("GoalController", () => {
  it("setGoal rejects empty condition", () => {
    const controller = new GoalController(mockEvaluator({ ok: false, reason: "x", impossible: false }));
    assert.throws(() => controller.setGoal("   "), /cannot be empty/);
  });

  it("clear returns message when no goal", () => {
    const controller = new GoalController(mockEvaluator({ ok: false, reason: "x", impossible: false }));
    assert.equal(controller.clear(), "No goal set");
  });

  it("evaluateAfterTurn returns allow when inactive", async () => {
    const controller = new GoalController(mockEvaluator({ ok: true, reason: "done", impossible: false }));
    const decision = await controller.evaluateAfterTurn([], false);
    assert.deepEqual(decision, { action: "allow" });
  });

  it("evaluateAfterTurn defers when background is running", async () => {
    const controller = new GoalController(mockEvaluator({ ok: true, reason: "done", impossible: false }));
    controller.setGoal("tests pass");
    const decision = await controller.evaluateAfterTurn([], true);
    assert.equal(decision.action, "defer");
  });

  it("achieved clears active goal", async () => {
    const controller = new GoalController(
      mockEvaluator({ ok: true, reason: "npm test passed", impossible: false }),
    );
    controller.setGoal("all tests green");
    const decision = await controller.evaluateAfterTurn([], false);
    assert.equal(decision.action, "achieved");
    assert.equal(controller.active, null);
    assert.match(controller.getStatus(), /Goal achieved/);
  });

  it("failed clears active goal when impossible", async () => {
    const controller = new GoalController(
      mockEvaluator({ ok: false, reason: "cannot access network", impossible: true }),
    );
    controller.setGoal("deploy to prod");
    const decision = await controller.evaluateAfterTurn([], false);
    assert.equal(decision.action, "failed");
    assert.equal(controller.active, null);
  });

  it("block increments consecutive blocks and pushes feedback path", async () => {
    const controller = new GoalController(
      mockEvaluator({ ok: false, reason: "missing test output", impossible: false }),
      2,
    );
    controller.setGoal("tests pass");
    const messages: ChatMessage[] = [{ role: "assistant", content: "done" }];

    const first = await controller.evaluateAfterTurn(messages, false);
    assert.equal(first.action, "block");
    assert.equal(controller.consecutiveBlocks, 1);

    const second = await controller.evaluateAfterTurn(messages, false);
    assert.equal(second.action, "block");

    const third = await controller.evaluateAfterTurn(messages, false);
    assert.equal(third.action, "limit");
    assert.notEqual(controller.active, null);
  });

  it("beginQuery resets consecutive blocks", async () => {
    const controller = new GoalController(
      mockEvaluator({ ok: false, reason: "missing evidence", impossible: false }),
    );
    controller.setGoal("ship feature");
    await controller.evaluateAfterTurn([], false);
    assert.equal(controller.consecutiveBlocks, 1);
    controller.beginQuery();
    assert.equal(controller.consecutiveBlocks, 0);
  });
});
