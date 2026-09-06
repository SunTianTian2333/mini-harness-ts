export class GoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoalError";
  }
}

export const MAX_GOAL_LENGTH = 4_000;
export const DEFAULT_GOAL_BLOCK_CAP = 5;
export const DEFAULT_EVALUATOR_MAX_CHARS = 24_000;

export type GoalState = {
  condition: string;
  set_at: number;
  iterations: number;
  last_reason: string | null;
};

export type GoalEvaluation = {
  ok: boolean;
  reason: string;
  impossible: boolean;
};

export type StopDecision =
  | { action: "allow" }
  | { action: "achieved"; reason: string }
  | { action: "failed"; reason: string }
  | { action: "block"; reason: string }
  | { action: "defer"; reason: string }
  | { action: "limit"; reason: string }
  | { action: "error"; reason: string };

export type GoalLoopOutcome =
  | { type: "none" }
  | { type: "continue" }
  | { type: "defer"; text: string }
  | { type: "return"; text: string };
