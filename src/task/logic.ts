import type { TaskStore } from "./store.js";
import type { Task } from "./types.js";

export function incompleteDependencies(store: TaskStore, task: Task): string[] {
  const incomplete: string[] = [];
  for (const dependency of task.blockedBy) {
    try {
      if (store.load(dependency).status !== "completed") {
        incomplete.push(dependency);
      }
    } catch {
      incomplete.push(dependency);
    }
  }
  return incomplete;
}

export function canStart(store: TaskStore, taskId: string): boolean {
  return incompleteDependencies(store, store.load(taskId)).length === 0;
}

export function claimTask(store: TaskStore, taskId: string, owner = "agent"): string {
  const task = store.load(taskId);
  if (task.status !== "pending") {
    return `Task ${taskId} is ${task.status}, cannot claim`;
  }
  const blocked = incompleteDependencies(store, task);
  if (blocked.length > 0) {
    return `Blocked by: ${blocked.join(", ")}`;
  }
  task.owner = owner;
  task.status = "in_progress";
  store.save(task);
  process.stdout.write(`\n\x1b[90m[claim]\x1b[0m ${task.subject} -> in_progress (owner: ${owner})\n`);
  return `Claimed ${task.id} (${task.subject})`;
}

export function completeTask(store: TaskStore, taskId: string, owner = "agent"): string {
  const task = store.load(taskId);
  if (task.status !== "in_progress") {
    return `Task ${taskId} is ${task.status}, cannot complete`;
  }
  if (task.owner !== owner) {
    return `Task ${taskId} is owned by ${task.owner}, not ${owner}`;
  }

  const readyBefore = new Set(
    store
      .list()
      .filter(
        (candidate) =>
          candidate.status === "pending" &&
          candidate.blockedBy.length > 0 &&
          canStart(store, candidate.id),
      )
      .map((candidate) => candidate.id),
  );

  task.status = "completed";
  store.save(task);

  const unblocked = store
    .list()
    .filter(
      (candidate) =>
        candidate.status === "pending" &&
        candidate.blockedBy.length > 0 &&
        !readyBefore.has(candidate.id) &&
        canStart(store, candidate.id),
    )
    .map((candidate) => candidate.subject);

  process.stdout.write(`\n\x1b[90m[complete]\x1b[0m ${task.subject}\n`);
  let message = `Completed ${task.id} (${task.subject})`;
  if (unblocked.length > 0) {
    message += `\nUnblocked: ${unblocked.join(", ")}`;
    process.stdout.write(`\n\x1b[90m[unblocked]\x1b[0m ${unblocked.join(", ")}\n`);
  }
  return message;
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "No tasks. Use create_task to add some.";
  }

  const markers: Record<string, string> = {
    pending: "[ ]",
    in_progress: "[>]",
    completed: "[x]",
  };

  return tasks
    .map((task) => {
      const marker = markers[task.status] ?? "[?]";
      const dependencies = task.blockedBy.length
        ? ` (blockedBy: ${task.blockedBy.join(", ")})`
        : "";
      const owner = task.owner ? ` [${task.owner}]` : "";
      return `${marker} ${task.id}: ${task.subject} [${task.status}]${owner}${dependencies}`;
    })
    .join("\n");
}
