import {
  DEFAULT_GOAL_BLOCK_CAP,
  GoalError,
  MAX_GOAL_LENGTH,
  type GoalEvaluation,
  type GoalState,
  type StopDecision,
} from "./types.js";

export type GoalEvaluator = {
  evaluate(condition: string, messages: import("../runtime/types.js").ChatMessage[]): Promise<GoalEvaluation>;
};

export class GoalController {
  active: GoalState | null = null;
  consecutiveBlocks = 0;
  lastStatus: Record<string, unknown> | null = null;

  constructor(
    private readonly evaluator: GoalEvaluator,
    private readonly blockCap = DEFAULT_GOAL_BLOCK_CAP,
  ) {
    if (blockCap < 1) {
      throw new GoalError("block_cap must be at least 1");
    }
  }

  beginQuery(): void {
    this.consecutiveBlocks = 0;
  }

  setGoal(condition: string): GoalState {
    const trimmed = condition.trim();
    if (!trimmed) {
      throw new GoalError("goal condition cannot be empty");
    }
    if (trimmed.length > MAX_GOAL_LENGTH) {
      throw new GoalError(`goal condition cannot exceed ${MAX_GOAL_LENGTH} characters`);
    }

    if (this.active !== null) {
      this.record({ active: false, met: false, failed: false, reason: "replaced by a new goal" });
    }

    this.active = {
      condition: trimmed,
      set_at: Date.now(),
      iterations: 0,
      last_reason: null,
    };
    this.consecutiveBlocks = 0;
    this.record({ active: true, met: false, failed: false, reason: "goal set" });
    return this.active;
  }

  clear(reason = "cleared"): string {
    if (this.active === null) {
      return "No goal set";
    }
    const condition = this.active.condition;
    this.record({ active: false, met: false, failed: false, reason });
    this.active = null;
    this.consecutiveBlocks = 0;
    return `Goal cleared: ${condition}`;
  }

  getStatus(): string {
    if (this.active === null) {
      if (this.lastStatus?.met === true) {
        return `Goal achieved: ${String(this.lastStatus.condition)}\n${String(this.lastStatus.reason)}`;
      }
      if (this.lastStatus?.failed === true) {
        return `Goal failed: ${String(this.lastStatus.condition)}\n${String(this.lastStatus.reason)}`;
      }
      return "No goal set";
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - this.active.set_at) / 1000));
    const lines = [
      `Goal active: ${this.active.condition}`,
      `Elapsed: ${elapsed}s`,
      `Evaluations: ${this.active.iterations}`,
    ];
    if (this.active.last_reason) {
      lines.push(`Last reason: ${this.active.last_reason}`);
    }
    return lines.join("\n");
  }

  async evaluateAfterTurn(
    messages: import("../runtime/types.js").ChatMessage[],
    backgroundRunning: boolean,
  ): Promise<StopDecision> {
    if (this.active === null) {
      return { action: "allow" };
    }
    if (backgroundRunning) {
      return { action: "defer", reason: "background work is still running" };
    }

    const state = this.active;
    try {
      const evaluation = await this.evaluator.evaluate(state.condition, messages);
      state.iterations += 1;
      state.last_reason = evaluation.reason;

      if (evaluation.ok) {
        this.record({ active: false, met: true, failed: false, reason: evaluation.reason });
        this.active = null;
        this.consecutiveBlocks = 0;
        return { action: "achieved", reason: evaluation.reason };
      }

      if (evaluation.impossible) {
        this.record({ active: false, met: false, failed: true, reason: evaluation.reason });
        this.active = null;
        this.consecutiveBlocks = 0;
        return { action: "failed", reason: evaluation.reason };
      }

      this.consecutiveBlocks += 1;
      this.record({ active: true, met: false, failed: false, reason: evaluation.reason });
      if (this.consecutiveBlocks > this.blockCap) {
        return {
          action: "limit",
          reason: `goal remains active, but the Stop hook blocked ${this.blockCap} consecutive turns`,
        };
      }
      return { action: "block", reason: evaluation.reason };
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      state.last_reason = reason;
      this.record({ active: true, met: false, failed: false, reason });
      return { action: "error", reason };
    }
  }

  private record(input: {
    active: boolean;
    met: boolean;
    failed: boolean;
    reason: string;
  }): void {
    this.lastStatus = {
      type: "goal_status",
      condition: this.active?.condition ?? "",
      active: input.active,
      met: input.met,
      failed: input.failed,
      reason: input.reason,
      iterations: this.active?.iterations ?? 0,
    };
  }
}
