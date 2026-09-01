import type { ChatMessage } from "../runtime/types.js";

export function estimateChars(messages: ChatMessage[]): number {
  return JSON.stringify(messages).length;
}

export function toolMessageContent(message: ChatMessage): string {
  return typeof message.content === "string" ? message.content : "";
}
