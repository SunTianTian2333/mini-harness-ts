import type { ChatTool } from "../runtime/types.js";
import { TaskStore } from "../task/store.js";
import {
  claimTask,
  completeTask,
  formatTaskList,
} from "../task/logic.js";

const TASK_ID_SCHEMA = {
  type: "string",
  pattern: "^task_[0-9a-f]{8}$",
} as const;

export const CREATE_TASK_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "create_task",
    description: "Create a persistent task and return its runtime-generated ID.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", minLength: 1 },
        description: { type: "string" },
      },
      required: ["subject"],
      additionalProperties: false,
    },
  },
};

export const UPDATE_TASK_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "update_task",
    description: "Add dependencies using IDs returned by create_task.",
    parameters: {
      type: "object",
      properties: {
        task_id: TASK_ID_SCHEMA,
        addBlockedBy: {
          type: "array",
          items: TASK_ID_SCHEMA,
          minItems: 1,
        },
      },
      required: ["task_id", "addBlockedBy"],
      additionalProperties: false,
    },
  },
};

export const LIST_TASKS_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "list_tasks",
    description: "List persistent tasks with status, owner, and dependencies.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

export const GET_TASK_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "get_task",
    description: "Get a persistent task by ID as JSON.",
    parameters: {
      type: "object",
      properties: {
        task_id: TASK_ID_SCHEMA,
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
};

export const CLAIM_TASK_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "claim_task",
    description: "Claim a pending task whose dependencies are all completed.",
    parameters: {
      type: "object",
      properties: {
        task_id: TASK_ID_SCHEMA,
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
};

export const COMPLETE_TASK_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "complete_task",
    description: "Complete the task claimed by this agent.",
    parameters: {
      type: "object",
      properties: {
        task_id: TASK_ID_SCHEMA,
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
};

export const TASK_TOOLS: ChatTool[] = [
  CREATE_TASK_TOOL,
  UPDATE_TASK_TOOL,
  LIST_TASKS_TOOL,
  GET_TASK_TOOL,
  CLAIM_TASK_TOOL,
  COMPLETE_TASK_TOOL,
];

function wrapError(error: unknown): string {
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

export function runCreateTask(cwd: string, subject: unknown, description?: unknown): string {
  try {
    if (typeof subject !== "string" || subject.trim().length === 0) {
      return "Error: create_task requires subject";
    }
    const store = TaskStore.forCwd(cwd);
    const task = store.create(subject, typeof description === "string" ? description : "");
    process.stdout.write(`\n\x1b[90m[create]\x1b[0m ${task.subject}\n`);
    return `Created ${task.id}: ${task.subject}`;
  } catch (error) {
    return wrapError(error);
  }
}

export function runUpdateTask(cwd: string, taskId: unknown, addBlockedBy: unknown): string {
  try {
    if (typeof taskId !== "string") {
      return "Error: update_task requires task_id";
    }
    if (!Array.isArray(addBlockedBy) || addBlockedBy.length === 0) {
      return "Error: update_task requires non-empty addBlockedBy";
    }
    const store = TaskStore.forCwd(cwd);
    const task = store.updateDependencies(taskId, addBlockedBy as string[]);
    const dependencies = task.blockedBy.join(", ") || "(none)";
    process.stdout.write(`\n\x1b[90m[update]\x1b[0m ${task.subject} blockedBy: ${dependencies}\n`);
    return `Updated ${task.id} blockedBy: ${dependencies}`;
  } catch (error) {
    return wrapError(error);
  }
}

export function runListTasks(cwd: string): string {
  try {
    const store = TaskStore.forCwd(cwd);
    return formatTaskList(store.list());
  } catch (error) {
    return wrapError(error);
  }
}

export function runGetTask(cwd: string, taskId: unknown): string {
  try {
    if (typeof taskId !== "string") {
      return "Error: get_task requires task_id";
    }
    const store = TaskStore.forCwd(cwd);
    return JSON.stringify(store.load(taskId), null, 2);
  } catch (error) {
    return wrapError(error);
  }
}

export function runClaimTask(cwd: string, taskId: unknown): string {
  try {
    if (typeof taskId !== "string") {
      return "Error: claim_task requires task_id";
    }
    return claimTask(TaskStore.forCwd(cwd), taskId);
  } catch (error) {
    return wrapError(error);
  }
}

export function runCompleteTask(cwd: string, taskId: unknown): string {
  try {
    if (typeof taskId !== "string") {
      return "Error: complete_task requires task_id";
    }
    return completeTask(TaskStore.forCwd(cwd), taskId);
  } catch (error) {
    return wrapError(error);
  }
}
