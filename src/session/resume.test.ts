import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { warnResumeCwdMismatch } from "./resume.js";

describe("warnResumeCwdMismatch", () => {
  it("returns false when recorded and current cwd match", () => {
    assert.equal(warnResumeCwdMismatch("/tmp/work", "/tmp/work"), false);
  });

  it("returns true when cwd differs", () => {
    assert.equal(warnResumeCwdMismatch("/tmp/work-a", "/tmp/work-b"), true);
  });
});
