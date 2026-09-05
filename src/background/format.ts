import type { BackgroundNotification } from "./types.js";

function formatOne(notification: BackgroundNotification): string {
  const { taskId, task, summary } = notification;
  return [
    "<task_notification>",
    `  <task_id>${taskId}</task_id>`,
    `  <status>${task.status}</status>`,
    `  <command>${task.command}</command>`,
    `  <summary>${summary.slice(0, 500)}</summary>`,
    "</task_notification>",
  ].join("\n");
}

export function formatBackgroundNotifications(notifications: BackgroundNotification[]): string {
  return `[Background completed]\n\n${notifications.map(formatOne).join("\n\n")}`;
}

export const BACKGROUND_AUTO_REQUEST =
  "Process the completed background task(s) and summarize the results.";
