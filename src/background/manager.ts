import { spawn, type ChildProcess } from "node:child_process";
import { kill } from "node:process";

import type { BackgroundNotification, BackgroundTask, BackgroundTaskStatus } from "./types.js";

const OUTPUT_LIMIT = 50_000;
const TIMEOUT_MS = 120_000;

function formatBashResult(output: string, exitCode: number | null): string {
  if (exitCode === 0 || exitCode === null) {
    return output;
  }
  return `Error: command exited with status ${exitCode}\n${output}`;
}

function killProcessGroup(child: ChildProcess): void {
  if (!child.pid) {
    return;
  }
  try {
    kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already exited */
    }
  }
}

export class BackgroundManager {
  private readonly tasks = new Map<string, BackgroundTask>();
  private readonly results = new Map<string, string>();
  private readonly ready: string[] = [];
  private readonly running = new Set<ChildProcess>();
  private counter = 0;

  start(command: string, cwd: string, toolUseId: string): string {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error("Bash command cannot be empty");
    }

    this.counter += 1;
    const taskId = `bg_${String(this.counter).padStart(4, "0")}`;
    this.tasks.set(taskId, {
      toolUseId,
      command: trimmed,
      status: "running",
    });

    const child = spawn("/bin/bash", ["-lc", trimmed], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.running.add(child);
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      killProcessGroup(child);
      this.finish(taskId, "Error: Timeout (120s)", "failed");
    }, TIMEOUT_MS);
    timeout.unref?.();

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      this.running.delete(child);
      const output = `${stdout}${stderr}`.trim();
      const clipped = output.length > 0 ? output.slice(0, OUTPUT_LIMIT) : "(no output)";
      const status: BackgroundTaskStatus = exitCode === 0 ? "completed" : "failed";
      this.finish(taskId, formatBashResult(clipped, exitCode), status);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      this.running.delete(child);
      this.finish(taskId, `Error: ${error.message}`, "failed");
    });

    process.stdout.write(`\n\x1b[90m[background]\x1b[0m started ${taskId}: ${trimmed.slice(0, 60)}\n`);
    return taskId;
  }

  private finish(taskId: string, summary: string, status: BackgroundTaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = status;
    this.results.set(taskId, summary);
    this.ready.push(taskId);
    process.stdout.write(`\n\x1b[90m[background]\x1b[0m finished ${taskId}: ${status}\n`);
  }

  async waitUntilReady(timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.ready.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  collect(): BackgroundNotification[] {
    const notifications: BackgroundNotification[] = [];
    while (this.ready.length > 0) {
      const taskId = this.ready.shift();
      if (!taskId) {
        continue;
      }
      const task = this.tasks.get(taskId);
      const summary = this.results.get(taskId) ?? "";
      if (!task) {
        continue;
      }
      notifications.push({ taskId, task: { ...task }, summary });
      this.tasks.delete(taskId);
      this.results.delete(taskId);
      process.stdout.write(`\n\x1b[90m[background]\x1b[0m collected ${taskId}: ${task.status}\n`);
    }
    return notifications;
  }

  shutdown(): void {
    for (const child of this.running) {
      killProcessGroup(child);
    }
    this.running.clear();
  }
}

let singleton: BackgroundManager | undefined;

export function getBackgroundManager(): BackgroundManager {
  if (!singleton) {
    singleton = new BackgroundManager();
  }
  return singleton;
}

export function shutdownBackgroundTasks(): void {
  singleton?.shutdown();
}

export function formatBackgroundPlaceholder(taskId: string): string {
  return `[Background task ${taskId} started] The result will be collected on a later turn.`;
}

export function shouldRunBackground(toolName: string, input: Record<string, unknown>): boolean {
  return toolName === "bash" && input.run_in_background === true;
}
