import type OpenAI from "openai";

import type { AssistantTurnFn } from "../agent/loop.js";

export function createMockAssistantTurn(
  steps: Array<
    | { content: string }
    | { toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> }
  >,
): AssistantTurnFn {
  let index = 0;

  return async () => {
    const step = steps[index];
    index += 1;
    if (!step) {
      return {
        message: { role: "assistant", content: "(no summary)", refusal: null },
        finishReason: "stop",
      };
    }

    if ("content" in step) {
      return {
        message: { role: "assistant", content: step.content, refusal: null },
        finishReason: "stop",
      };
    }

    const tool_calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = step.toolCalls.map(
      (call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      }),
    );

    return {
      message: { role: "assistant", content: "", tool_calls, refusal: null },
      finishReason: "tool_calls",
    };
  };
}
