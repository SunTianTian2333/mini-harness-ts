import type { ChatMessage } from "../runtime/types.js";
import { DEFAULT_EVALUATOR_MAX_CHARS } from "./types.js";

function plainContent(content: ChatMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return String(content ?? "");
  }

  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (block.type === "text") {
      parts.push(block.text);
    } else if (block.type === "image_url") {
      parts.push("[image]");
    }
  }
  return parts.join("\n");
}

function renderMessage(message: ChatMessage): string {
  const role = "role" in message ? String(message.role).toUpperCase() : "UNKNOWN";
  let body = plainContent(message.content);

  if (message.role === "assistant" && "tool_calls" in message && message.tool_calls?.length) {
    const calls = message.tool_calls
      .map((call) => `[tool_call ${call.function.name} ${call.function.arguments}]`)
      .join("\n");
    body = body ? `${body}\n${calls}` : calls;
  }

  if (message.role === "tool" && "tool_call_id" in message) {
    body = `[tool_result ${message.tool_call_id}]\n${body}`;
  }

  return `${role}:\n${body}`;
}

export function transcriptText(
  messages: ChatMessage[],
  maxCharacters = DEFAULT_EVALUATOR_MAX_CHARS,
): string {
  const rendered = messages.map(renderMessage);
  const selected: string[] = [];
  let size = 0;

  for (let index = rendered.length - 1; index >= 0; index -= 1) {
    const item = rendered[index] ?? "";
    const itemSize = item.length + 2;
    if (!selected.length && itemSize > maxCharacters) {
      const marker = "\n...[middle omitted]...\n";
      const available = Math.max(0, maxCharacters - marker.length);
      const head = Math.floor(available * 0.75);
      const tail = available - head;
      if (available === 0) {
        selected.push(marker.slice(0, maxCharacters));
      } else {
        selected.push(item.slice(0, head) + marker + item.slice(-tail));
      }
      break;
    }
    if (selected.length && size + itemSize > maxCharacters) {
      break;
    }
    selected.push(item);
    size += itemSize;
  }

  return selected.reverse().join("\n\n");
}
