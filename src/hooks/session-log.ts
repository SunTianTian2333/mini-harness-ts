import type { SessionStore } from "../session/store.js";
import type { LlmResponsePayload } from "../session/types.js";
import type { ToolCallBlock } from "./types.js";

export function createSessionLogHooks(store: SessionStore) {
  return {
    userMessage(query: string): null {
      store.append("user/message", { content: query });
      return null;
    },

    turnStart(turnIndex: number): null {
      store.append("turn/start", { turn_index: turnIndex });
      return null;
    },

    llmResponse(payload: LlmResponsePayload): null {
      store.append("llm/response", {
        content: payload.content,
        tool_calls: payload.tool_calls ?? null,
        finish_reason: payload.finish_reason ?? null,
      });
      return null;
    },

    toolStart(block: ToolCallBlock): null {
      store.append("tool/start", { id: block.id, name: block.name, input: block.input });
      return null;
    },

    toolDenied(block: ToolCallBlock, reason: string): null {
      store.append("tool/denied", {
        id: block.id,
        name: block.name,
        input: block.input,
        reason,
        content: reason,
      });
      return null;
    },

    toolResult(block: ToolCallBlock, output: string): null {
      store.append("tool/result", { id: block.id, name: block.name, content: output });
      return null;
    },
  };
}
