import type { TodoReminderTracker } from "../todo/reminder.js";

export type HookEvent =
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolBatch"
  | "Stop"
  | "TurnStart"
  | "LlmResponse"
  | "ToolDenied";

export type SideEffectHookEvent = Extract<
  HookEvent,
  "UserPromptSubmit" | "PostToolUse" | "TurnStart" | "LlmResponse" | "ToolDenied"
>;

export interface ToolCallBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface PostToolBatchContext {
  results: Array<{ id: string; content: string }>;
  usedTodo: boolean;
  todoReminder: TodoReminderTracker;
}

export type BlockingHookResult = string | null | undefined;

export type HookCallback = (...args: unknown[]) => BlockingHookResult | Promise<BlockingHookResult>;

export type PostToolBatchCallback = (ctx: PostToolBatchContext) => void | Promise<void>;
