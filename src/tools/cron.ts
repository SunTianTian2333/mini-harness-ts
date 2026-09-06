import type { ChatTool } from "../runtime/types.js";
import { CronStore } from "../cron/store.js";

const CRON_ID_SCHEMA = {
  type: "string",
  pattern: "^cron_[0-9a-f]{8}$",
} as const;

export const SCHEDULE_CRON_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "schedule_cron",
    description:
      "Schedule a prompt to run automatically at cron times in local time. Use five-field cron syntax (minute hour day month weekday).",
    parameters: {
      type: "object",
      properties: {
        cron: { type: "string", minLength: 1 },
        prompt: { type: "string", minLength: 1 },
        recurring: { type: "boolean", description: "Repeat on future matches (default true)." },
        durable: {
          type: "boolean",
          description: "Persist across CLI restarts under .mini-harness/crons/ (default true).",
        },
      },
      required: ["cron", "prompt"],
      additionalProperties: false,
    },
  },
};

export const LIST_CRONS_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "list_crons",
    description: "List scheduled cron jobs.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

export const CANCEL_CRON_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "cancel_cron",
    description: "Cancel a scheduled cron job by ID.",
    parameters: {
      type: "object",
      properties: {
        job_id: CRON_ID_SCHEMA,
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
};

export const CRON_TOOLS = [SCHEDULE_CRON_TOOL, LIST_CRONS_TOOL, CANCEL_CRON_TOOL] as const;

export function runScheduleCron(
  cwd: string,
  cron: unknown,
  prompt: unknown,
  recurring?: unknown,
  durable?: unknown,
): string {
  if (typeof cron !== "string" || cron.trim().length === 0) {
    return "Error: schedule_cron requires cron";
  }
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return "Error: schedule_cron requires prompt";
  }

  const store = CronStore.forCwd(cwd);
  const result = store.schedule(
    cron,
    prompt,
    typeof recurring === "boolean" ? recurring : true,
    typeof durable === "boolean" ? durable : true,
  );
  if (typeof result === "string") {
    return `Error: ${result}`;
  }
  process.stdout.write(`  [cron] scheduled ${result.id}: ${result.cron} -> ${result.prompt.slice(0, 60)}\n`);
  return JSON.stringify(result, null, 2);
}

export function runListCrons(cwd: string): string {
  const jobs = CronStore.forCwd(cwd).list();
  if (jobs.length === 0) {
    return "(no cron jobs)";
  }
  return JSON.stringify(jobs, null, 2);
}

export function runCancelCron(cwd: string, jobId: unknown): string {
  if (typeof jobId !== "string" || jobId.trim().length === 0) {
    return "Error: cancel_cron requires job_id";
  }
  const message = CronStore.forCwd(cwd).cancel(jobId.trim());
  if (message.startsWith("Job")) {
    return `Error: ${message}`;
  }
  process.stdout.write(`  [cron] ${message}\n`);
  return message;
}
