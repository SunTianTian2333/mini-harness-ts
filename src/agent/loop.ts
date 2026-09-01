import { triggerHooks, triggerSideEffectHooks } from "../hooks/registry.js";
import { createAssistantTurn } from "../llm/client.js";
import type { ChatMessage } from "../runtime/types.js";
import { MAX_TURNS, getSystemPrompt } from "../runtime/types.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import { TOOL_SCHEMAS } from "../tools/index.js";
import { runToolBatch } from "./tool-batch.js";

export async function runLoop(messages: ChatMessage[], cwd: string): Promise<string> {
  const system = getSystemPrompt(cwd);
  const todoReminder = new TodoReminderTracker();

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    await triggerSideEffectHooks("TurnStart", turn);

    const { message: msg, finishReason } = await createAssistantTurn(system, messages, TOOL_SCHEMAS);

    await triggerSideEffectHooks("LlmResponse", {
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
      finish_reason: finishReason,
    });

    const assistantEntry: ChatMessage = {
      role: "assistant",
      content: msg.content ?? "",
      ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}),
    };
    messages.push(assistantEntry);

    if (!msg.tool_calls?.length) {
      const force = await triggerHooks("Stop", messages);
      if (force) {
        messages.push({ role: "user", content: force });
        continue;
      }
      return msg.content ?? "(empty response)";
    }

    const toolResults = await runToolBatch(msg.tool_calls, cwd, todoReminder);
    for (const result of toolResults) {
      messages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }
  }

  return "超过最大轮数，未得到最终回答";
}
