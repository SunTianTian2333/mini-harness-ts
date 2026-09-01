import type { ChatTool } from "../runtime/types.js";
import { todoManager } from "../todo/manager.js";

export const TODO_WRITE_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "todo_write",
    description: "Create and manage a task list for the current coding session.",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              content: { type: "string", minLength: 1 },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
              },
            },
            required: ["content", "status"],
          },
        },
      },
      required: ["todos"],
    },
  },
};

export function runTodoWrite(todos: unknown): string {
  try {
    const output = todoManager.update(todos);
    process.stdout.write(`\n\x1b[33m## Current Tasks\x1b[0m\n${output}\n`);
    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
