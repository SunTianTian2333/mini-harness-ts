import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldStoreMemory, validateMemoryCandidate } from "./filter.js";
import type { MemoryRecord } from "./types.js";

describe("memory filters", () => {
  it("accepts persistent candidates and rejects temporary scope", () => {
    const candidate = validateMemoryCandidate(
      {
        name: "prefer-tabs",
        type: "user",
        scope: "persistent",
        description: "Prefers tabs",
        body: "Use tabs for indentation.",
      },
      true,
    );
    assert.ok(candidate);
    assert.equal(shouldStoreMemory(candidate!, []), true);

    const temporary = validateMemoryCandidate(
      {
        name: "temp-rule",
        type: "feedback",
        scope: "current_task",
        description: "Only for this session",
        body: "Do not create files in this session.",
      },
      true,
    );
    assert.ok(temporary);
    assert.equal(shouldStoreMemory(temporary!, []), false);
  });

  it("rejects duplicate and temporary marker content", () => {
    const existing: MemoryRecord[] = [
      {
        filename: "prefer-tabs.md",
        name: "prefer-tabs",
        description: "Prefers tabs",
        type: "user",
        body: "Use tabs.",
      },
    ];

    const duplicate = validateMemoryCandidate(
      {
        name: "prefer-tabs",
        type: "user",
        scope: "persistent",
        description: "Prefers tabs",
        body: "Use tabs.",
      },
      true,
    );
    assert.ok(duplicate);
    assert.equal(shouldStoreMemory(duplicate!, existing), false);

    const sessionScoped = validateMemoryCandidate(
      {
        name: "no-files",
        type: "feedback",
        scope: "persistent",
        description: "Session rule",
        body: "Do not create files in this session.",
      },
      true,
    );
    assert.ok(sessionScoped);
    assert.equal(shouldStoreMemory(sessionScoped!, existing), false);
  });
});
