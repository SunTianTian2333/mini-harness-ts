import { appendReminder } from "../todo/reminder.js";
import { isSubagentContext } from "../subagent/context.js";
import type { PostToolBatchContext } from "./types.js";

export function reminderHook(ctx: PostToolBatchContext): void {
  if (isSubagentContext()) {
    return;
  }
  const reminder = ctx.todoReminder.afterToolBatch(ctx.usedTodo);
  if (reminder && ctx.results.length > 0) {
    const last = ctx.results[ctx.results.length - 1]!;
    last.content = appendReminder(last.content, reminder);
  }
}
