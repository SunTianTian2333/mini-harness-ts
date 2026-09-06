import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { PromptGoalEvaluator } from "./evaluator.js";
import { GoalError } from "./types.js";

describe("PromptGoalEvaluator", () => {
  it("parses fenced JSON from evaluator response", async () => {
    const evaluator = new PromptGoalEvaluator(async () =>
      "```json\n{\"ok\": true, \"reason\": \"verified\", \"impossible\": false}\n```",
    );

    const result = await evaluator.evaluate("tests pass", [{ role: "assistant", content: "npm test ok" }]);
    assert.deepEqual(result, { ok: true, reason: "verified", impossible: false });
  });

  it("rejects invalid JSON", async () => {
    const evaluator = new PromptGoalEvaluator(async () => "not json");
    await assert.rejects(
      () => evaluator.evaluate("x", []),
      (error: unknown) => error instanceof GoalError,
    );
  });

  it("rejects ok and impossible together", async () => {
    const evaluator = new PromptGoalEvaluator(
      async () => '{"ok": true, "reason": "bad", "impossible": true}',
    );
    await assert.rejects(
      () => evaluator.evaluate("x", []),
      (error: unknown) => error instanceof GoalError,
    );
  });
});
