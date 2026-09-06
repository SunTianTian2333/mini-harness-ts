import { getBackgroundManager } from "../background/manager.js";
import type { ChatMessage } from "../runtime/types.js";
import { getGoalController } from "./singleton.js";
import type { GoalLoopOutcome } from "./types.js";

function appendGoalFooter(assistantText: string, label: string, reason: string): string {
  const base = assistantText.trim().length > 0 ? assistantText : "(empty response)";
  return `${base}\n\n[${label}] ${reason}`;
}

export async function applyGoalGate(
  messages: ChatMessage[],
  assistantText: string,
  skipGoalGate: boolean,
): Promise<GoalLoopOutcome> {
  if (skipGoalGate) {
    return { type: "none" };
  }

  const controller = getGoalController();
  const decision = await controller.evaluateAfterTurn(messages, getBackgroundManager().hasRunning());

  switch (decision.action) {
    case "allow":
      return { type: "none" };
    case "defer":
      return { type: "defer", text: assistantText };
    case "block": {
      const condition = controller.active?.condition ?? "";
      messages.push({
        role: "user",
        content:
          `[Goal still active]\nCondition: ${condition}\nEvaluator: ${decision.reason}\n` +
          "Continue working and surface the missing evidence.",
      });
      return { type: "continue" };
    }
    case "achieved":
      return {
        type: "return",
        text: appendGoalFooter(assistantText, "Goal achieved", decision.reason),
      };
    case "failed":
      return {
        type: "return",
        text: appendGoalFooter(assistantText, "Goal failed", decision.reason),
      };
    case "limit":
      return {
        type: "return",
        text: appendGoalFooter(assistantText, "Goal limit", decision.reason),
      };
    case "error":
      return {
        type: "return",
        text: appendGoalFooter(assistantText, "Goal evaluation error", decision.reason),
      };
  }
}
