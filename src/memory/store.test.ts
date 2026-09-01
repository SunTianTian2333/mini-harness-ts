import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MINI_HARNESS_DIR } from "../runtime/paths.js";
import { MemoryStore, memorySlug } from "./store.js";

function memoryRoot(root: string): string {
  return join(root, MINI_HARNESS_DIR, "memory");
}

describe("MemoryStore", () => {
  it("writes records and rebuilds MEMORY.md index", () => {
    const root = mkdtempSync(join(tmpdir(), "memory-store-"));
    mkdirSync(memoryRoot(root), { recursive: true });
    const store = new MemoryStore(memoryRoot(root));

    store.writeRecord("User Tabs", "user", "Prefers tabs for indentation", "Use tabs, not spaces.");

    const records = store.listRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.name, "User Tabs");
    assert.match(store.readIndex(), /User Tabs/);

    const content = readFileSync(join(memoryRoot(root), `${memorySlug("User Tabs")}.md`), "utf-8");
    assert.match(content, /type: user/);
    assert.match(content, /Use tabs, not spaces/);
  });

  it("rejects path escape in filenames", () => {
    const root = mkdtempSync(join(tmpdir(), "memory-store-"));
    const store = new MemoryStore(memoryRoot(root));
    assert.throws(() => store.memoryPath("../outside.md"), /Invalid memory filename/);
  });
});
