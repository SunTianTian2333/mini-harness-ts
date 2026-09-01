import { appendReminder } from "../todo/reminder.js";
import type { PostToolBatchContext } from "./types.js";

export function reminderHook(ctx: PostToolBatchContext): void {
  const reminder = ctx.todoReminder.afterToolBatch(ctx.usedTodo);
  if (reminder && ctx.results.length > 0) {
    const last = ctx.results[ctx.results.length - 1]!;
    last.content = appendReminder(last.content, reminder);
  }
}
