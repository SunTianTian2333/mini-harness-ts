import { createAssistantTurn } from "../llm/client.js";
import type { ChatMessage } from "../runtime/types.js";
import { MAX_TURNS, getSystemPrompt } from "../runtime/types.js";
import { TOOL_SCHEMAS, executeTool } from "../tools/index.js";

/**
 * Agent Loop（OpenAI Tool Calling · DeepSeek 兼容）：
 * LLM → tool_calls? → execute → role=tool 回灌 → 直到模型不再调工具
 */
export async function runLoop(messages: ChatMessage[], cwd: string): Promise<string> {
  const system = getSystemPrompt(cwd);

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const msg = await createAssistantTurn(system, messages, TOOL_SCHEMAS);

    const assistantEntry: ChatMessage = {
      role: "assistant",
      content: msg.content ?? "",
    };
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      assistantEntry.tool_calls = msg.tool_calls;
    }
    messages.push(assistantEntry);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "(empty response)";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") {
        continue;
      }

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "Error: invalid tool arguments JSON",
        });
        continue;
      }

      const command = typeof args.command === "string" ? args.command : "";
      process.stdout.write(`\x1b[33m$ ${command}\x1b[0m\n`);

      const output = await executeTool(tc.function.name, args, cwd);
      process.stdout.write(`${output.slice(0, 200)}${output.length > 200 ? "…" : ""}\n`);

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: output,
      });
    }
  }

  return "超过最大轮数，未得到最终回答";
}
