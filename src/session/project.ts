import type { ChatMessage } from "../runtime/types.js";
import type { SessionEventRecord } from "./types.js";

export function projectToMessages(events: SessionEventRecord[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const event of events) {
    switch (event.eventType) {
      case "user/message": {
        const content = event.payload.content;
        if (typeof content === "string" && content.length > 0) {
          messages.push({ role: "user", content });
        }
        break;
      }
      case "llm/response": {
        const content = event.payload.content;
        const toolCalls = event.payload.tool_calls;
        const entry: ChatMessage = {
          role: "assistant",
          content: typeof content === "string" ? content : "",
        };
        if (Array.isArray(toolCalls) && toolCalls.length > 0) {
          Object.assign(entry, { tool_calls: toolCalls });
        }
        messages.push(entry);
        break;
      }
      case "tool/result":
      case "tool/denied": {
        const id = event.payload.id;
        const content = event.payload.content ?? event.payload.reason;
        if (typeof id === "string" && typeof content === "string") {
          messages.push({ role: "tool", tool_call_id: id, content });
        }
        break;
      }
      default:
        break;
    }
  }

  return messages;
}
