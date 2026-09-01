export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  status: TodoStatus;
}

const MARKERS: Record<TodoStatus, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
};

export class TodoManager {
  private items: TodoItem[] = [];

  update(raw: unknown): string {
    const todos = this.parseTodos(raw);
    this.validate(todos);
    this.items = todos;
    return this.render();
  }

  private parseTodos(raw: unknown): TodoItem[] {
    let list = raw;
    if (typeof raw === "string") {
      list = JSON.parse(raw) as unknown;
    }
    if (!Array.isArray(list)) {
      throw new Error("todos must be a list");
    }
    return list as TodoItem[];
  }

  private validate(todos: TodoItem[]): void {
    if (todos.length > 20) {
      throw new Error("Max 20 todos allowed");
    }

    let inProgressCount = 0;
    for (let i = 0; i < todos.length; i += 1) {
      const todo = todos[i];
      if (!todo || typeof todo !== "object") {
        throw new Error(`todos[${i}] must be an object`);
      }
      const content = String(todo.content ?? "").trim();
      const status = String(todo.status ?? "pending").toLowerCase() as TodoStatus;
      if (!content) {
        throw new Error(`todos[${i}] requires content`);
      }
      if (!MARKERS[status]) {
        throw new Error(`todos[${i}] has invalid status '${status}'`);
      }
      if (status === "in_progress") {
        inProgressCount += 1;
      }
      todos[i] = { content, status };
    }

    if (inProgressCount > 1) {
      throw new Error("Only one todo can be in_progress at a time");
    }
  }

  render(): string {
    if (this.items.length === 0) {
      return "No todos.";
    }

    const lines = this.items.map((todo) => `${MARKERS[todo.status]} ${todo.content}`);
    const done = this.items.filter((todo) => todo.status === "completed").length;
    lines.push(`\n(${done}/${this.items.length} completed)`);
    return lines.join("\n");
  }
}

/** 会话级单例（内存态，不落盘） */
export const todoManager = new TodoManager();
