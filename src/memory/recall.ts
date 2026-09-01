import type { ChatMessage } from "../runtime/types.js";
import { createTextCompletion } from "../llm/client.js";
import { extractJsonArray } from "./json.js";
import { MemoryStore } from "./store.js";
import type { MemoryRecord } from "./types.js";

const RECALL_CHAR_LIMIT = 20_000;
const CATALOG_CHAR_LIMIT = 12_000;
const MAX_ITEMS = 5;
const RECALL_MAX_TOKENS = 200;

export type TextCompletion = (prompt: string, maxTokens?: number) => Promise<string>;

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

export function buildNumberedCatalog(records: MemoryRecord[]): string {
  return records
    .map((record, index) => {
      const name = record.name.split(/\s+/).join(" ");
      const description = record.description.split(/\s+/).join(" ");
      return `${index}: ${name} - ${description}`;
    })
    .join("\n")
    .slice(0, CATALOG_CHAR_LIMIT);
}

export function parseCatalogIndices(
  text: string,
  records: MemoryRecord[],
  maxItems: number,
): string[] {
  const selected: string[] = [];
  for (const index of extractJsonArray(text)) {
    if (typeof index !== "number" || !Number.isInteger(index)) {
      continue;
    }
    if (index < 0 || index >= records.length) {
      continue;
    }
    const filename = records[index]?.filename;
    if (!filename || selected.includes(filename)) {
      continue;
    }
    selected.push(filename);
    if (selected.length === maxItems) {
      break;
    }
  }
  return selected;
}

export function keywordSelection(records: MemoryRecord[], query: string, maxItems = MAX_ITEMS): string[] {
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
  return ranked.slice(0, maxItems).map((item) => item.filename);
}

export async function llmMemorySelection(
  records: MemoryRecord[],
  query: string,
  maxItems: number,
  completeText: TextCompletion = createTextCompletion,
): Promise<string[]> {
  const catalog = buildNumberedCatalog(records);
  const prompt = [
    "Select memory records that are relevant to the current user request.",
    "Return only a JSON array of catalog indices, such as [0, 2].",
    "Return [] when none are relevant.",
    "",
    `Current request:\n${query}`,
    "",
    `Memory catalog:\n${catalog}`,
  ].join("\n");

  const response = await completeText(prompt, RECALL_MAX_TOKENS);
  return parseCatalogIndices(response, records, maxItems);
}

export async function selectRelevantMemories(
  store: MemoryStore,
  messages: ChatMessage[],
  options?: { completeText?: TextCompletion },
): Promise<string[]> {
  const records = store.listRecords();
  const query = recentUserText(messages);
  if (records.length === 0 || !query) {
    return [];
  }

  const completeText = options?.completeText ?? createTextCompletion;
  try {
    return await llmMemorySelection(records, query, MAX_ITEMS, completeText);
  } catch {
    return keywordSelection(records, query, MAX_ITEMS);
  }
}

export async function loadRecalledMemories(
  store: MemoryStore,
  messages: ChatMessage[],
  options?: { completeText?: TextCompletion },
): Promise<string> {
  const selected = await selectRelevantMemories(store, messages, options);
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
