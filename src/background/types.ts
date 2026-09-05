export type BackgroundTaskStatus = "running" | "completed" | "failed";

export interface BackgroundTask {
  toolUseId: string;
  command: string;
  status: BackgroundTaskStatus;
}

export interface BackgroundNotification {
  taskId: string;
  task: BackgroundTask;
  summary: string;
}
