import type { RunLoopOptions } from "../agent/loop.js";
import { runLoop } from "../agent/loop.js";
import type { ChatMessage } from "../runtime/types.js";
import { LOOP_MAX_TURNS_EXCEEDED } from "../runtime/types.js";
import { buildSubagentSystemPrompt } from "../runtime/prompt.js";
import { withSubagentContext } from "./context.js";
import { assembleSubagentToolPool } from "./tool-pool.js";
import { SUB_MAX_TURNS, SUBAGENT_TIMEOUT_MESSAGE } from "./types.js";

export type RunSubagentOptions = {
  createAssistantTurn?: RunLoopOptions["createAssistantTurn"];
};

export async function runSubagent(
  prompt: string,
  cwd: string,
  options?: RunSubagentOptions,
): Promise<string> {
  process.stdout.write("\x1b[35m[Subagent started]\x1b[0m\n");
  try {
    return await withSubagentContext(async () => {
      const messages: ChatMessage[] = [{ role: "user", content: prompt }];
      const answer = await runLoop(messages, cwd, prompt, {
        mode: "subagent",
        toolPool: assembleSubagentToolPool(),
        maxTurns: SUB_MAX_TURNS,
        buildSystemPrompt: () => buildSubagentSystemPrompt(cwd),
        createAssistantTurn: options?.createAssistantTurn,
      });

      if (answer === LOOP_MAX_TURNS_EXCEEDED) {
        return SUBAGENT_TIMEOUT_MESSAGE;
      }
      return answer;
    });
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    process.stdout.write("\x1b[35m[Subagent done]\x1b[0m\n");
  }
}
