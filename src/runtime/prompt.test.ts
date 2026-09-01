import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "./paths.js";
import { buildSystemPrompt } from "./prompt.js";
import { initSkillLoader } from "../skill/loader.js";
import { MemoryStore } from "../memory/store.js";
import type { ChatMessage } from "./types.js";

describe("buildSystemPrompt", () => {
  it("includes memory catalog and recalled records", () => {
    const root = mkdtempSync(join(tmpdir(), "prompt-memory-"));
    mkdirSync(join(root, MINI_HARNESS_DIR, "memory"), { recursive: true });
    mkdirSync(join(root, MINI_HARNESS_DIR, "skills"), { recursive: true });

    initSkillLoader(root);
    const store = new MemoryStore(join(root, MINI_HARNESS_DIR, "memory"));
    store.writeRecord("Indentation Preference", "user", "Prefers tabs for indentation", "Use tabs.");

    const messages: ChatMessage[] = [{ role: "user", content: "What indentation do I prefer?" }];
    const prompt = buildSystemPrompt(root, messages);

    assert.match(prompt, /Memory catalog:/);
    assert.match(prompt, /Relevant memory records:/);
    assert.match(prompt, /Prefers tabs/);
  });
});
