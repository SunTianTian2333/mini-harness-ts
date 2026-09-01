import type { MemoryCandidate, MemoryRecord } from "./types.js";
import { MEMORY_TYPES, TEMPORARY_MEMORY_MARKERS } from "./types.js";
import { memorySlug } from "./store.js";

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateMemoryCandidate(
  raw: unknown,
  requireScope = false,
): MemoryCandidate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const name = String(record.name ?? "").trim();
  const type = String(record.type ?? "").trim();
  const description = String(record.description ?? "").trim();
  const body = String(record.body ?? "").trim();
  const scope = String(record.scope ?? "").trim();

  if (!name || !description || !body) {
    return null;
  }
  if (!MEMORY_TYPES.includes(type as MemoryCandidate["type"])) {
    return null;
  }
  if (requireScope && scope !== "persistent" && scope !== "current_task") {
    return null;
  }

  return {
    name,
    type: type as MemoryCandidate["type"],
    scope: (scope === "current_task" ? "current_task" : "persistent") as MemoryCandidate["scope"],
    description,
    body,
  };
}

export function shouldStoreMemory(candidate: MemoryCandidate, existing: MemoryRecord[]): boolean {
  if (candidate.scope !== "persistent") {
    return false;
  }

  const candidateText = normalizedText(`${candidate.name}\n${candidate.description}\n${candidate.body}`);
  if (TEMPORARY_MEMORY_MARKERS.some((marker) => candidateText.includes(marker))) {
    return false;
  }

  const slug = memorySlug(candidate.name);
  const normalizedDescription = normalizedText(candidate.description);
  const normalizedBody = normalizedText(candidate.body);

  for (const memory of existing) {
    if (memorySlug(memory.name) === slug) {
      return false;
    }
    if (normalizedText(memory.description) === normalizedDescription) {
      return false;
    }
    if (normalizedText(memory.body) === normalizedBody) {
      return false;
    }
  }

  return true;
}
