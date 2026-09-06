import { GoalError } from "./types.js";
import { getGoalController } from "./singleton.js";

const CLEAR_ALIASES = new Set(["clear", "off", "reset", "none", "cancel"]);

const GOAL_COMMAND = /^\/goal(?:\s+|$)/i;

export type GoalCommandResult =
  | { handled: false }
  | { handled: true; output: string; autoStart?: string; beginQuery?: boolean };

export function parseGoalCommand(line: string): GoalCommandResult {
  const trimmed = line.trim();
  if (!GOAL_COMMAND.test(trimmed)) {
    return { handled: false };
  }

  const rest = trimmed.replace(/^\/goal\s*/i, "").trim();
  const controller = getGoalController();

  if (!rest) {
    return { handled: true, output: controller.getStatus(), beginQuery: false };
  }

  if (CLEAR_ALIASES.has(rest.toLowerCase())) {
    return { handled: true, output: controller.clear(), beginQuery: false };
  }

  try {
    controller.setGoal(rest);
    return {
      handled: true,
      output: `Goal set: ${rest}`,
      autoStart: rest,
      beginQuery: true,
    };
  } catch (error) {
    const message = error instanceof GoalError ? error.message : String(error);
    return { handled: true, output: `Error: ${message}`, beginQuery: false };
  }
}
