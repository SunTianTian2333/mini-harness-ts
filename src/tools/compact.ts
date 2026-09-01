import type { ChatTool } from "../runtime/types.js";

export const COMPACT_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "compact",
    description: "Summarize earlier conversation to free context space.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

export function runCompact(): string {
  return "Compaction requested after this tool batch.";
}
