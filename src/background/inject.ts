import type { ChatMessage } from "../runtime/types.js";
import { getBackgroundManager } from "./manager.js";
import type { BackgroundNotification } from "./types.js";

function formatNotification(notification: BackgroundNotification): string {
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

export function injectBackgroundResults(messages: ChatMessage[]): number {
  const notifications = getBackgroundManager().collect();
  if (notifications.length === 0) {
    return 0;
  }

  const text = `[Background completed]\n\n${notifications.map(formatNotification).join("\n\n")}`;
  const last = messages.at(-1);
  if (last?.role === "user" && typeof last.content === "string") {
    last.content = `${last.content}\n\n${text}`;
  } else {
    messages.push({ role: "user", content: text });
  }
  return notifications.length;
}
