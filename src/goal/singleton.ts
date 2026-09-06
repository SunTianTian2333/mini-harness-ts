import { GoalController } from "./controller.js";
import { PromptGoalEvaluator } from "./evaluator.js";
import type { GoalEvaluator } from "./controller.js";
import { DEFAULT_GOAL_BLOCK_CAP } from "./types.js";

let singleton: GoalController | undefined;
let evaluatorOverride: GoalEvaluator | undefined;

function resolveBlockCap(): number {
  const raw = process.env.GOAL_BLOCK_CAP;
  if (!raw) {
    return DEFAULT_GOAL_BLOCK_CAP;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_GOAL_BLOCK_CAP;
}

export function getGoalController(): GoalController {
  if (!singleton) {
    singleton = new GoalController(evaluatorOverride ?? new PromptGoalEvaluator(), resolveBlockCap());
  }
  return singleton;
}

export function setGoalEvaluatorForTests(evaluator: GoalEvaluator): void {
  evaluatorOverride = evaluator;
  singleton = undefined;
}

export function resetGoalControllerForTests(): void {
  singleton = undefined;
  evaluatorOverride = undefined;
}
