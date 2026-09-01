import type { ChatMessage } from "../runtime/types.js";
import { estimateChars, toolMessageContent } from "./estimate.js";
import {
  formatPersistedPreview,
  parsePersistedOutputPath,
  saveToolOutput,
} from "./persist.js";
import {
  KEEP_RECENT_TOOL_RESULTS,
  MICRO_MIN_REPLACE_LEN,
  PERSISTED_PREVIEW_CHARS,
} from "./types.js";
import { findLatestToolBatch } from "./budget.js";

function lastAssistantIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return index;
    }
  }
  return -1;
}

export function listToolMessageIndexes(messages: ChatMessage[]): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role === "tool") {
      indexes.push(index);
    }
  }
  return indexes;
}

export function microCompact(
  messages: ChatMessage[],
  cwd: string,
  targetChars: number,
): ChatMessage[] {
  const lastAssistant = lastAssistantIndex(messages);
  const toolIndexes = listToolMessageIndexes(messages).filter((index) => index <= lastAssistant);
  const consumed = toolIndexes.slice(0, Math.max(0, toolIndexes.length - KEEP_RECENT_TOOL_RESULTS));

  for (const index of consumed) {
    if (estimateChars(messages) <= targetChars) {
      break;
    }
    const message = messages[index];
    if (!message || message.role !== "tool") {
      continue;
    }
    const content = toolMessageContent(message);
    if (content.length <= MICRO_MIN_REPLACE_LEN || parsePersistedOutputPath(content)) {
      continue;
    }

    const savedPath = saveToolOutput(cwd, message.tool_call_id ?? `tool-${index}`, content);
    message.content = `[Earlier tool result saved at ${savedPath}]`;
  }

  return messages;
}

export function fitToolResults(
  messages: ChatMessage[],
  cwd: string,
  targetChars: number,
  previewChars = 1_000,
): ChatMessage[] {
  const batch = findLatestToolBatch(messages);
  if (!batch) {
    return messages;
  }

  const entries: Array<{ index: number; content: string; toolCallId: string }> = [];
  for (let index = batch.start; index <= batch.end; index += 1) {
    const message = messages[index];
    if (!message || message.role !== "tool") {
      continue;
    }
    entries.push({
      index,
      content: toolMessageContent(message),
      toolCallId: message.tool_call_id ?? `tool-${index}`,
    });
  }

  for (const entry of entries.sort((left, right) => right.content.length - left.content.length)) {
    if (estimateChars(messages) <= targetChars) {
      break;
    }
    const message = messages[entry.index];
    if (!message || message.role !== "tool") {
      continue;
    }
    const replacement = formatPersistedPreview(
      saveToolOutput(cwd, entry.toolCallId, entry.content),
      entry.content,
      previewChars,
    );
    if (replacement.length < entry.content.length) {
      message.content = replacement;
    }
  }

  return messages;
}
