import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runEdit,
  runGlob,
  runRead,
  runWrite,
  safePath,
} from "./file.js";

describe("safePath", () => {
  it("resolves paths inside workspace", () => {
    const workdir = "/tmp/work";
    assert.equal(safePath("src/main.ts", workdir), join("/tmp/work", "src/main.ts"));
  });

  it("rejects path traversal outside workspace", () => {
    assert.throws(() => safePath("../../../etc/passwd", "/tmp/work"), /Path escapes workspace/);
  });
});

describe("file tools", () => {
  it("read, write, edit, and glob within workspace", async () => {
    const workdir = mkdtempSync(join(tmpdir(), "file-tools-"));
    mkdirSync(join(workdir, "src"), { recursive: true });
    writeFileSync(join(workdir, "src", "a.ts"), "line1\nline2\nline3\n", "utf-8");
    writeFileSync(join(workdir, "src", "b.ts"), "beta\n", "utf-8");

    assert.match(await runRead("src/a.ts", workdir), /line1/);
    assert.match(await runRead("src/a.ts", workdir, 1), /more lines/);

    assert.match(await runWrite("out/new.txt", "hello", workdir), /Wrote 5 bytes/);
    assert.equal(await runRead("out/new.txt", workdir), "hello");

    assert.match(await runEdit("out/new.txt", "hello", "hi", workdir), /Edited out\/new.txt/);
    assert.equal(await runRead("out/new.txt", workdir), "hi");

    const globResult = await runGlob("src/*.ts", workdir);
    assert.match(globResult, /src\/a\.ts/);
    assert.match(globResult, /src\/b\.ts/);
  });

  it("returns errors for missing files and path escape", async () => {
    const workdir = mkdtempSync(join(tmpdir(), "file-tools-"));

    assert.match(await runRead("missing.txt", workdir), /^Error:/);
    assert.match(await runWrite("../outside.txt", "x", workdir), /Path escapes workspace/);
    assert.match(await runGlob("**/*.ts", mkdtempSync(join(tmpdir(), "empty-"))), /\(no matches\)/);
  });
});
