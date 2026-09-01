import type { ChatMessage } from "../runtime/types.js";
import { toolResultBudget } from "./budget.js";
import { estimateChars } from "./estimate.js";
import { fitToolResults, microCompact } from "./micro.js";
import { snipCompact } from "./snip.js";
import { compactHistory } from "./summarize.js";
import { CONTEXT_CHAR_LIMIT } from "./types.js";

export type PrepareContextResult = {
  messages: ChatMessage[];
  autoCompacted: boolean;
};

/** P7a–d: budget → snip → micro/fit → compactHistory when still over limit. */
export async function prepareContext(
  messages: ChatMessage[],
  cwd: string,
  activeRequest: string,
): Promise<PrepareContextResult> {
  toolResultBudget(messages, cwd);
  snipCompact(messages, cwd);

  let autoCompacted = false;

  if (estimateChars(messages) > CONTEXT_CHAR_LIMIT) {
    const target = Math.floor(CONTEXT_CHAR_LIMIT * 0.8);
    microCompact(messages, cwd, target);
    if (estimateChars(messages) > CONTEXT_CHAR_LIMIT) {
      fitToolResults(messages, cwd, target);
    }
    if (estimateChars(messages) > CONTEXT_CHAR_LIMIT) {
      console.log("[auto compact]");
      const compacted = await compactHistory(messages, cwd, activeRequest);
      messages.splice(0, messages.length, ...compacted);
      autoCompacted = true;
    }
  }

  return { messages, autoCompacted };
}
