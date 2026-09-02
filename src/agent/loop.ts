import { triggerHooks, triggerSideEffectHooks } from "../hooks/registry.js";
import { createAssistantTurn } from "../llm/client.js";
import { prepareContext } from "../compact/compactor.js";
import { compactHistory, isContextLengthError, reactiveCompact } from "../compact/summarize.js";
import { MAX_REACTIVE_RETRIES } from "../compact/types.js";
import { buildSystemPrompt } from "../runtime/prompt.js";
import type { ChatMessage } from "../runtime/types.js";
import { MAX_TURNS } from "../runtime/types.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import { assembleToolPool } from "../tools/index.js";
import { runToolBatch } from "./tool-batch.js";

function latestUserRequest(messages: ChatMessage[], fallback: string): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string" && !message.content.startsWith("[")) {
      return message.content;
    }
  }
  return fallback;
}

export async function runLoop(
  messages: ChatMessage[],
  cwd: string,
  activeRequest: string,
): Promise<string> {
  const todoReminder = new TodoReminderTracker();
  let reactiveRetries = 0;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    await triggerSideEffectHooks("TurnStart", turn);

    const request = latestUserRequest(messages, activeRequest);
    await prepareContext(messages, cwd, request);
    const system = await buildSystemPrompt(cwd, messages);
    const toolPool = assembleToolPool();

    let msg;
    let finishReason;
    try {
      ({ message: msg, finishReason } = await createAssistantTurn(system, messages, toolPool.tools));
      reactiveRetries = 0;
    } catch (error) {
      if (isContextLengthError(error) && reactiveRetries < MAX_REACTIVE_RETRIES) {
        console.log("[reactive compact]");
        const compacted = await reactiveCompact(messages, cwd, request);
        messages.splice(0, messages.length, ...compacted);
        reactiveRetries += 1;
        continue;
      }
      throw error;
    }

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

    const { results: toolResults, compactRequested } = await runToolBatch(
      msg.tool_calls,
      cwd,
      todoReminder,
      toolPool.execute,
    );
    for (const result of toolResults) {
      messages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }

    if (compactRequested) {
      const compacted = await compactHistory(messages, cwd, request);
      messages.splice(0, messages.length, ...compacted);
    }
  }

  return "超过最大轮数，未得到最终回答";
}
