import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import type { ChatMessage } from "../runtime/types.js";
import {
  buildNumberedCatalog,
  keywordSelection,
  loadRecalledMemories,
  parseCatalogIndices,
  selectRelevantMemories,
} from "./recall.js";
import { MemoryStore } from "./store.js";
import type { MemoryRecord } from "./types.js";

function memoryRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR, "memory");
}

function sampleRecords(): MemoryRecord[] {
  return [
    {
      filename: "indentation-preference.md",
      name: "Indentation Preference",
      description: "Prefers tabs for indentation",
      type: "user",
      body: "Use tabs.",
    },
    {
      filename: "database-choice.md",
      name: "Database Choice",
      description: "Project uses PostgreSQL",
      type: "project",
      body: "PostgreSQL 16 on staging.",
    },
  ];
}

describe("memory recall", () => {
  it("builds numbered catalog for LLM selection", () => {
    const catalog = buildNumberedCatalog(sampleRecords());
    assert.match(catalog, /^0: Indentation Preference - Prefers tabs/);
    assert.match(catalog, /\n1: Database Choice - Project uses PostgreSQL/);
  });

  it("parses catalog indices and ignores invalid entries", () => {
    const selected = parseCatalogIndices("[99, 0, 0, 1]", sampleRecords(), 5);
    assert.deepEqual(selected, ["indentation-preference.md", "database-choice.md"]);
  });

  it("selects relevant records via LLM catalog indices", async () => {
    const root = mkdtempSync(join(tmpdir(), "memory-recall-"));
    mkdirSync(memoryRoot(root), { recursive: true });
    const store = new MemoryStore(memoryRoot(root));
    store.writeRecord("Indentation Preference", "user", "Prefers tabs for indentation", "Use tabs.");
    store.writeRecord("Database Choice", "project", "Project uses PostgreSQL", "PostgreSQL 16 on staging.");

    const messages: ChatMessage[] = [{ role: "user", content: "What indentation style do I prefer?" }];
    const selected = await selectRelevantMemories(store, messages, {
      completeText: async () => "[1]",
    });
    assert.deepEqual(selected, ["indentation-preference.md"]);

    const recalled = await loadRecalledMemories(store, messages, {
      completeText: async () => "[1]",
    });
    assert.match(recalled, /Indentation Preference/);
    assert.doesNotMatch(recalled, /PostgreSQL/);
  });

  it("returns empty selection when LLM returns [] even if keywords would match", async () => {
    const root = mkdtempSync(join(tmpdir(), "memory-recall-"));
    mkdirSync(memoryRoot(root), { recursive: true });
    const store = new MemoryStore(memoryRoot(root));
    store.writeRecord("Indentation Preference", "user", "Prefers tabs for indentation", "Use tabs.");

    const messages: ChatMessage[] = [{ role: "user", content: "What indentation style do I prefer?" }];
    const selected = await selectRelevantMemories(store, messages, {
      completeText: async () => "[]",
    });
    assert.deepEqual(selected, []);
  });

  it("falls back to keyword selection when LLM selection fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "memory-recall-"));
    mkdirSync(memoryRoot(root), { recursive: true });
    const store = new MemoryStore(memoryRoot(root));
    store.writeRecord("Indentation Preference", "user", "Prefers tabs for indentation", "Use tabs.");
    store.writeRecord("Database Choice", "project", "Project uses PostgreSQL", "PostgreSQL 16 on staging.");

    const messages: ChatMessage[] = [{ role: "user", content: "What indentation style do I prefer?" }];
    const selected = await selectRelevantMemories(store, messages, {
      completeText: async () => {
        throw new Error("LLM unavailable");
      },
    });
    assert.deepEqual(selected, ["indentation-preference.md"]);
  });

  it("keywordSelection ranks by overlapping terms", () => {
    const selected = keywordSelection(
      sampleRecords(),
      "What indentation style do I prefer?",
      5,
    );
    assert.deepEqual(selected, ["indentation-preference.md"]);
  });
});
