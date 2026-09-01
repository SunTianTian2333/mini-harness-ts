import type { ChatMessage } from "../runtime/types.js";
import { MemoryStore } from "./store.js";

const RECALL_CHAR_LIMIT = 20_000;
const MAX_ITEMS = 5;

function messageText(message: ChatMessage): string {
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function recentUserText(messages: ChatMessage[], maxTurns = 3): string {
  const turns: string[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }
    const text = messageText(message).trim();
    if (text) {
      turns.push(text);
    }
    if (turns.length === maxTurns) {
      break;
    }
  }
  return turns.reverse().join("\n").slice(0, 4000);
}

function keywordSelection(records: ReturnType<MemoryStore["listRecords"]>, query: string): string[] {
  const words = new Set(
    [...query.toLowerCase().matchAll(/[a-z0-9_]{3,}|[\u4e00-\u9fff]{2,}/g)].map((match) => match[0]),
  );
  const ranked: Array<{ score: number; filename: string }> = [];

  for (const record of records) {
    const catalogText = `${record.name} ${record.description}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (catalogText.includes(word)) {
        score += 1;
      }
    }
    if (score > 0) {
      ranked.push({ score, filename: record.filename });
    }
  }

  ranked.sort((left, right) => right.score - left.score || left.filename.localeCompare(right.filename));
  return ranked.slice(0, MAX_ITEMS).map((item) => item.filename);
}

export function selectRelevantMemories(store: MemoryStore, messages: ChatMessage[]): string[] {
  const records = store.listRecords();
  const query = recentUserText(messages);
  if (records.length === 0 || !query) {
    return [];
  }
  return keywordSelection(records, query);
}

export function loadRecalledMemories(store: MemoryStore, messages: ChatMessage[]): string {
  const selected = selectRelevantMemories(store, messages);
  if (selected.length === 0) {
    return "";
  }

  const loaded: Array<{ source: string; content: string }> = [];
  let remaining = RECALL_CHAR_LIMIT;
  for (const filename of selected) {
    const content = store.readFile(filename);
    if (!content || remaining <= 0) {
      continue;
    }
    const recalled = content.slice(0, remaining);
    loaded.push({ source: filename, content: recalled });
    remaining -= recalled.length;
  }

  return loaded.length > 0 ? JSON.stringify(loaded, null, 2) : "";
}
