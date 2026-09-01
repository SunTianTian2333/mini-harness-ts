import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { getToolResultsDir, getTranscriptsDir } from "../runtime/paths.js";
import {
  LARGE_RESULT_CHAR_LIMIT,
  PERSISTED_OUTPUT_CLOSE,
  PERSISTED_OUTPUT_OPEN,
  PERSISTED_PREVIEW_CHARS,
} from "./types.js";

function safeToolResultId(toolCallId: string): string {
  if (toolCallId.includes("/") || toolCallId.includes("\\") || toolCallId.includes("..")) {
    throw new Error(`Invalid tool result id: ${toolCallId}`);
  }
  const safe = toolCallId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return safe || "unknown";
}

function resolveUnderToolResults(cwd: string, filename: string): string {
  const root = resolve(getToolResultsDir(cwd));
  const path = resolve(root, filename);
  const rel = relative(root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Tool result path escapes store: ${filename}`);
  }
  return path;
}

export function parsePersistedOutputPath(content: string): string | null {
  if (!content.startsWith(`${PERSISTED_OUTPUT_OPEN}\n`)) {
    const marker = "[Earlier tool result saved at ";
    if (content.startsWith(marker) && content.endsWith("]")) {
      return content.slice(marker.length, -1);
    }
    return null;
  }

  for (const line of content.split("\n")) {
    if (line.startsWith("Full output: ")) {
      return line.slice("Full output: ".length);
    }
  }
  return null;
}

export function saveToolOutput(cwd: string, toolCallId: string, output: string): string {
  mkdirSync(getToolResultsDir(cwd), { recursive: true });
  const filename = `${safeToolResultId(toolCallId)}.txt`;
  const path = resolveUnderToolResults(cwd, filename);
  writeFileSync(path, output, "utf-8");
  return path;
}

export function readPersistedPreview(path: string, previewChars: number): string {
  try {
    return readFileSync(path, "utf-8").slice(0, previewChars);
  } catch {
    return "";
  }
}

export function formatPersistedPreview(
  savedPath: string,
  output: string,
  previewChars = PERSISTED_PREVIEW_CHARS,
): string {
  const preview = output.slice(0, previewChars);
  return [
    PERSISTED_OUTPUT_OPEN,
    `Full output: ${savedPath}`,
    "Preview:",
    preview,
    PERSISTED_OUTPUT_CLOSE,
  ].join("\n");
}

export function persistLargeToolOutput(
  cwd: string,
  toolCallId: string,
  output: string,
  previewChars = PERSISTED_PREVIEW_CHARS,
): string {
  if (output.length <= LARGE_RESULT_CHAR_LIMIT) {
    return output;
  }

  const existingPath = parsePersistedOutputPath(output);
  if (existingPath) {
    const preview = readPersistedPreview(existingPath, previewChars);
    return formatPersistedPreview(existingPath, preview || output, previewChars);
  }

  const savedPath = saveToolOutput(cwd, toolCallId, output);
  return formatPersistedPreview(savedPath, output, previewChars);
}

export function writeTranscript(cwd: string, messages: unknown[]): string {
  const dir = getTranscriptsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `transcript_${randomUUID().replace(/-/g, "")}.jsonl`);
  const lines = messages.map((message) => `${JSON.stringify(message)}\n`).join("");
  writeFileSync(path, lines, "utf-8");
  return path;
}
