import type { ChatTool } from "../runtime/types.js";

export const RUN_SUBAGENT_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "run_subagent",
    description:
      "Run a subagent with fresh conversation context for a focused subtask and return its final text. Use for exploration or self-contained work so intermediate tool output does not enter the parent conversation.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Self-contained instructions for the subagent.",
          minLength: 1,
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
};
