import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import type { ChatMessage } from "../runtime/types.js";
import { loadRecalledMemories, selectRelevantMemories } from "./recall.js";
import { MemoryStore } from "./store.js";

function memoryRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR, "memory");
}

describe("memory recall", () => {
  it("selects relevant records by keyword", () => {
    const root = mkdtempSync(join(tmpdir(), "memory-recall-"));
    mkdirSync(memoryRoot(root), { recursive: true });
    const store = new MemoryStore(memoryRoot(root));
    store.writeRecord("Indentation Preference", "user", "Prefers tabs for indentation", "Use tabs.");
    store.writeRecord("Database Choice", "project", "Project uses PostgreSQL", "PostgreSQL 16 on staging.");

    const messages: ChatMessage[] = [{ role: "user", content: "What indentation style do I prefer?" }];
    const selected = selectRelevantMemories(store, messages);
    assert.equal(selected.length, 1);
    assert.match(selected[0] ?? "", /indentation-preference/);

    const recalled = loadRecalledMemories(store, messages);
    assert.match(recalled, /Indentation Preference/);
    assert.doesNotMatch(recalled, /PostgreSQL/);
  });
});
