export type MemoryType = "user" | "feedback" | "project" | "reference";

export type MemoryScope = "persistent" | "current_task";

export interface MemoryRecord {
  filename: string;
  name: string;
  description: string;
  type: MemoryType;
  body: string;
}

export interface MemoryCandidate {
  name: string;
  type: MemoryType;
  scope: MemoryScope;
  description: string;
  body: string;
}

export const MEMORY_TYPES: MemoryType[] = ["user", "feedback", "project", "reference"];

export const TEMPORARY_MEMORY_MARKERS = [
  "this session",
  "current session",
  "this turn",
  "current turn",
  "this task",
  "current task",
  "for now",
  "just this time",
  "today only",
  "本次会话",
  "当前会话",
  "这一轮",
  "当前轮次",
  "本次任务",
  "当前任务",
  "暂时",
  "今回だけ",
  "このセッション",
  "現在のタスク",
] as const;
