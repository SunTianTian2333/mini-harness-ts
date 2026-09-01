import type { ChatMessage } from "../runtime/types.js";

export function summaryHook(messages: ChatMessage[]): null {
  const toolCount = messages.filter((message) => message.role === "tool").length;
  process.stdout.write(`\x1b[90m[HOOK] Stop: session used ${toolCount} tool calls\x1b[0m\n`);
  return null;
}
