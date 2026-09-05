export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner: string | null;
  blockedBy: string[];
}

export const TASK_ID_PATTERN = /^task_[0-9a-f]{8}$/;

export function isTaskStatus(value: string): value is TaskStatus {
  return value === "pending" || value === "in_progress" || value === "completed";
}
