const REMINDER_TEXT = "<reminder>Update your todos.</reminder>";
const REMINDER_THRESHOLD = 3;

/** 跟踪连续未调用 todo_write 的 tool 轮次（s05 同构，不依赖 s04 Hook 表） */
export class TodoReminderTracker {
  private roundsSinceTodo = 0;

  afterToolBatch(usedTodo: boolean): string | null {
    if (usedTodo) {
      this.roundsSinceTodo = 0;
      return null;
    }

    this.roundsSinceTodo += 1;
    if (this.roundsSinceTodo >= REMINDER_THRESHOLD) {
      this.roundsSinceTodo = 0;
      return REMINDER_TEXT;
    }
    return null;
  }
}

export function appendReminder(content: string, reminder: string): string {
  return `${content}\n\n${reminder}`;
}
