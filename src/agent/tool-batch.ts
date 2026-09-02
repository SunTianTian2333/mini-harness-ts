import {
  triggerHooks,
  triggerPostToolBatch,
  triggerSideEffectHooks,
} from "../hooks/registry.js";
import type { ToolCallBlock } from "../hooks/types.js";
import { TodoReminderTracker } from "../todo/reminder.js";
import type { AssembledToolPool } from "../mcp/types.js";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

function parseToolArgs(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatToolLabel(name: string, args: Record<string, unknown>): string {
  if (name === "bash" && typeof args.command === "string") {
    return `$ ${args.command}`;
  }
  return `> ${name}`;
}

const INVALID_TOOL_ARGS = "Error: invalid tool arguments JSON";

function toToolCallBlock(id: string, name: string, input: Record<string, unknown>): ToolCallBlock {
  return { id, name, input };
}

export async function runToolBatch(
  toolCalls: ChatCompletionMessageToolCall[],
  cwd: string,
  todoReminder: TodoReminderTracker,
  executeTool: AssembledToolPool["execute"],
): Promise<{ results: Array<{ id: string; content: string }>; compactRequested: boolean }> {
  let usedTodo = false;
  let compactRequested = false;
  const toolResults: Array<{ id: string; content: string }> = [];

  for (const tc of toolCalls) {
    if (tc.type !== "function") {
      continue;
    }

    const args = parseToolArgs(tc.function.arguments);
    if (!args) {
      const block = toToolCallBlock(tc.id, tc.function.name, { raw: tc.function.arguments });
      process.stdout.write(`\x1b[36m> ${block.name}\x1b[0m\n`);
      await triggerSideEffectHooks("ToolDenied", block, INVALID_TOOL_ARGS);
      toolResults.push({ id: tc.id, content: INVALID_TOOL_ARGS });
      continue;
    }

    const block = toToolCallBlock(tc.id, tc.function.name, args);
    process.stdout.write(`\x1b[36m${formatToolLabel(block.name, block.input)}\x1b[0m\n`);

    if (block.name === "compact") {
      const output = "Compaction requested after this tool batch.";
      process.stdout.write(`${output}\n`);
      await triggerSideEffectHooks("PostToolUse", block, output);
      toolResults.push({ id: block.id, content: output });
      compactRequested = true;
      continue;
    }

    const blocked = await triggerHooks("PreToolUse", block);
    if (blocked) {
      await triggerSideEffectHooks("ToolDenied", block, blocked);
      toolResults.push({ id: block.id, content: blocked });
      continue;
    }

    const output = await executeTool(block.name, block.input, cwd);
    process.stdout.write(`${output.slice(0, 200)}${output.length > 200 ? "…" : ""}\n`);
    await triggerSideEffectHooks("PostToolUse", block, output);
    toolResults.push({ id: block.id, content: output });

    if (block.name === "todo_write") {
      usedTodo = true;
    }
  }

  await triggerPostToolBatch({ results: toolResults, usedTodo, todoReminder });

  return { results: toolResults, compactRequested };
}
