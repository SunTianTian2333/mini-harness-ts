import type { ChatMessage } from "../runtime/types.js";
import { formatBackgroundNotifications } from "./format.js";
import { getBackgroundManager } from "./manager.js";

export function injectBackgroundResults(messages: ChatMessage[]): number {
  const notifications = getBackgroundManager().collect();
  if (notifications.length === 0) {
    return 0;
  }

  const text = formatBackgroundNotifications(notifications);
  const last = messages.at(-1);
  if (last?.role === "user" && typeof last.content === "string") {
    last.content = `${last.content}\n\n${text}`;
  } else {
    messages.push({ role: "user", content: text });
  }
  return notifications.length;
}
