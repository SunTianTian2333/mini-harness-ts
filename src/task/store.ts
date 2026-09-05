import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { getTasksDir } from "../runtime/paths.js";
import { isTaskStatus, TASK_ID_PATTERN, type Task } from "./types.js";

export class TaskStore {
  constructor(private readonly tasksDir: string) {}

  static forCwd(cwd: string): TaskStore {
    const dir = getTasksDir(cwd);
    mkdirSync(dir, { recursive: true });
    return new TaskStore(dir);
  }

  taskPath(taskId: string, createRoot = false): string {
    if (!TASK_ID_PATTERN.test(taskId)) {
      throw new Error(`Invalid task ID: ${taskId}`);
    }
    if (createRoot) {
      mkdirSync(this.tasksDir, { recursive: true });
    }
    const root = resolve(this.tasksDir);
    const path = resolve(root, `${taskId}.json`);
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Invalid task ID: ${taskId}`);
    }
    return path;
  }

  exists(taskId: string): boolean {
    try {
      readFileSync(this.taskPath(taskId), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  create(subject: string, description = ""): Task {
    const trimmed = subject.trim();
    if (!trimmed) {
      throw new Error("Task subject cannot be empty");
    }

    mkdirSync(this.tasksDir, { recursive: true });
    for (let attempt = 0; attempt < 100; attempt++) {
      const task: Task = {
        id: `task_${randomBytes(4).toString("hex")}`,
        subject: trimmed,
        description,
        status: "pending",
        owner: null,
        blockedBy: [],
      };
      try {
        writeFileSync(this.taskPath(task.id, true), `${JSON.stringify(task, null, 2)}\n`, {
          flag: "wx",
        });
        return task;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Could not allocate a unique task ID");
  }

  load(taskId: string): Task {
    const raw = readFileSync(this.taskPath(taskId), "utf-8");
    const data = JSON.parse(raw) as Task;
    if (data.id !== taskId) {
      throw new Error(`Task file ID does not match ${taskId}`);
    }
    if (!isTaskStatus(data.status)) {
      throw new Error(`Invalid task status: ${data.status}`);
    }
    return data;
  }

  save(task: Task): void {
    writeFileSync(this.taskPath(task.id, true), `${JSON.stringify(task, null, 2)}\n`, "utf-8");
  }

  list(): Task[] {
    let entries: string[];
    try {
      entries = readdirSync(this.tasksDir);
    } catch {
      return [];
    }

    return entries
      .filter((entry) => entry.startsWith("task_") && entry.endsWith(".json"))
      .sort()
      .map((entry) => this.load(entry.replace(/\.json$/, "")));
  }

  dependsOn(taskId: string, targetId: string): boolean {
    const pending = [taskId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === targetId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      pending.push(...this.load(current).blockedBy);
    }
    return false;
  }

  updateDependencies(taskId: string, addBlockedBy: string[]): Task {
    if (!Array.isArray(addBlockedBy)) {
      throw new Error("addBlockedBy must be a list of task IDs");
    }

    const task = this.load(taskId);
    if (task.status !== "pending" || task.owner !== null) {
      throw new Error(
        `Task ${taskId} dependencies can only be updated while pending and unowned`,
      );
    }

    const dependencies = [...new Set(addBlockedBy)];
    for (const dependency of dependencies) {
      if (dependency === taskId) {
        throw new Error("Task cannot depend on itself");
      }
      if (!this.exists(dependency)) {
        throw new Error(`Dependency not found: ${dependency}`);
      }
      if (!task.blockedBy.includes(dependency) && this.dependsOn(dependency, taskId)) {
        throw new Error(`Dependency cycle detected: ${taskId} -> ${dependency}`);
      }
    }

    for (const dependency of dependencies) {
      if (!task.blockedBy.includes(dependency)) {
        task.blockedBy.push(dependency);
      }
    }
    this.save(task);
    return task;
  }
}
