import type { ChatMessage } from "../runtime/types.js";
import { writeTranscript } from "./persist.js";
import { SNIP_HEAD_MESSAGES, SNIP_MAX_MESSAGES } from "./types.js";

const ARCHIVE_MARKER_RE = /^\[(\d+) messages archived at (.+)\]$/;

export function isArchiveMarker(message: ChatMessage): boolean {
  if (message.role !== "user" || typeof message.content !== "string") {
    return false;
  }
  return ARCHIVE_MARKER_RE.test(message.content.trim());
}

export function hasToolCalls(message: ChatMessage): boolean {
  return message.role === "assistant" && Boolean(message.tool_calls?.length);
}

export function isToolMessage(message: ChatMessage): boolean {
  return message.role === "tool";
}

function adjustHeadEnd(messages: ChatMessage[], headEnd: number, tailStart: number): number {
  let end = headEnd;
  if (end > 0 && end <= messages.length && hasToolCalls(messages[end - 1]!)) {
    while (end < tailStart && isToolMessage(messages[end]!)) {
      end += 1;
    }
  }
  return end;
}

function adjustTailStart(messages: ChatMessage[], tailStart: number): number {
  let start = tailStart;
  if (start > 0 && isToolMessage(messages[start]!) && hasToolCalls(messages[start - 1]!)) {
    start -= 1;
  }
  return start;
}

export function snipCompact(
  messages: ChatMessage[],
  cwd: string,
  maxMessages = SNIP_MAX_MESSAGES,
  headCount = SNIP_HEAD_MESSAGES,
): ChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  let headEnd = headCount;
  let tailStart = messages.length - (maxMessages - headCount - 1);
  headEnd = adjustHeadEnd(messages, headEnd, tailStart);
  tailStart = adjustTailStart(messages, tailStart);

  if (headEnd >= tailStart) {
    return messages;
  }

  const archivedCount = tailStart - headEnd;
  const transcriptPath = writeTranscript(cwd, messages);
  const marker: ChatMessage = {
    role: "user",
    content: `[${archivedCount} messages archived at ${transcriptPath}]`,
  };

  return [...messages.slice(0, headEnd), marker, ...messages.slice(tailStart)];
}
