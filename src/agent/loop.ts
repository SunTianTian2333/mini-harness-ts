import type { AssembledToolPool } from "../mcp/types.js";
import { injectBackgroundResults } from "../background/inject.js";
import { triggerHooks, triggerSideEffectHooks } from "../hooks/registry.js";
import { createAssistantTurn } from "../llm/client.js";
import { prepareContext } from "../compact/compactor.js";
import { compactHistory, isContextLengthError, reactiveCompact } from "../compact/summarize.js";
import { MAX_REACTIVE_RETRIES } from "../compact/types.js";
import { buildSystemPrompt } from "../runtime/prompt.js";
import type { ChatMessage } from "../runtime/types.js";
import { LOOP_MAX_TURNS_EXCEEDED, MAX_TURNS } from "../runtime/types.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import { assembleToolPool } from "../tools/index.js";
import { applyGoalGate } from "../goal/gate.js";
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

export type AssistantTurnFn = typeof createAssistantTurn;

export type RunLoopOptions = {
  toolPool?: AssembledToolPool;
  mode?: "parent" | "subagent";
  maxTurns?: number;
  skipGoalGate?: boolean;
  createAssistantTurn?: AssistantTurnFn;
  buildSystemPrompt?: (cwd: string, messages: ChatMessage[]) => Promise<string> | string;
};

export async function runLoop(
  messages: ChatMessage[],
  cwd: string,
  activeRequest: string,
  options?: RunLoopOptions,
): Promise<string> {
  const todoReminder = new TodoReminderTracker();
  let reactiveRetries = 0;
  const isSubagent = options?.mode === "subagent";
  const maxTurns = options?.maxTurns ?? MAX_TURNS;
  const llm = options?.createAssistantTurn ?? createAssistantTurn;
  const resolveSystemPrompt =
    options?.buildSystemPrompt ??
    ((cwdValue: string, messageHistory: ChatMessage[]) => buildSystemPrompt(cwdValue, messageHistory));

  for (let turn = 0; turn < maxTurns; turn += 1) {
    await triggerSideEffectHooks("TurnStart", turn);
    if (!isSubagent) {
      injectBackgroundResults(messages);
    }

    const request = latestUserRequest(messages, activeRequest);
    if (!isSubagent) {
      await prepareContext(messages, cwd, request);
    }
    const system = await resolveSystemPrompt(cwd, messages);
    const toolPool = options?.toolPool ?? assembleToolPool();

    let msg;
    let finishReason;
    try {
      ({ message: msg, finishReason } = await llm(system, messages, toolPool.tools));
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
      const assistantText = msg.content ?? "(empty response)";
      const goalOutcome = await applyGoalGate(
        messages,
        assistantText,
        isSubagent || options?.skipGoalGate === true,
      );
      if (goalOutcome.type === "continue") {
        continue;
      }
      if (goalOutcome.type === "defer") {
        return goalOutcome.text;
      }
      if (goalOutcome.type === "return") {
        const force = await triggerHooks("Stop", messages);
        if (force) {
          messages.push({ role: "user", content: force });
          continue;
        }
        return goalOutcome.text;
      }

      const force = await triggerHooks("Stop", messages);
      if (force) {
        messages.push({ role: "user", content: force });
        continue;
      }
      return assistantText;
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

    if (compactRequested && !isSubagent) {
      const compacted = await compactHistory(messages, cwd, request);
      messages.splice(0, messages.length, ...compacted);
    }
  }

  return LOOP_MAX_TURNS_EXCEEDED;
}
