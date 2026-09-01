import type { ChatMessage } from "../runtime/types.js";
import { toolMessageContent } from "./estimate.js";
import { persistLargeToolOutput } from "./persist.js";
import { LARGE_RESULT_CHAR_LIMIT, TOOL_RESULT_BATCH_CHAR_LIMIT } from "./types.js";

export interface ToolBatchRange {
  start: number;
  end: number;
}

export function findLatestToolBatch(messages: ChatMessage[]): ToolBatchRange | null {
  if (messages.length === 0) {
    return null;
  }

  let end = messages.length - 1;
  if (messages[end]?.role !== "tool") {
    return null;
  }

  let start = end;
  while (start > 0 && messages[start - 1]?.role === "tool") {
    start -= 1;
  }

  return { start, end };
}

export function toolResultBudget(
  messages: ChatMessage[],
  cwd: string,
  batchLimit = TOOL_RESULT_BATCH_CHAR_LIMIT,
  largeLimit = LARGE_RESULT_CHAR_LIMIT,
): ChatMessage[] {
  const batch = findLatestToolBatch(messages);
  if (!batch) {
    return messages;
  }

  const entries: Array<{ index: number; toolCallId: string; content: string }> = [];
  for (let index = batch.start; index <= batch.end; index += 1) {
    const message = messages[index];
    if (message?.role !== "tool") {
      continue;
    }
    entries.push({
      index,
      toolCallId: message.tool_call_id ?? `tool-${index}`,
      content: toolMessageContent(message),
    });
  }

  let total = entries.reduce((sum, entry) => sum + entry.content.length, 0);
  const ranked = [...entries].sort((left, right) => right.content.length - left.content.length);

  for (const entry of ranked) {
    if (total <= batchLimit) {
      break;
    }
    if (entry.content.length <= largeLimit) {
      continue;
    }

    const message = messages[entry.index];
    if (!message || message.role !== "tool") {
      continue;
    }

    const replacement = persistLargeToolOutput(cwd, entry.toolCallId, entry.content);
    message.content = replacement;
    total = total - entry.content.length + replacement.length;
    entry.content = replacement;
  }

  return messages;
}
