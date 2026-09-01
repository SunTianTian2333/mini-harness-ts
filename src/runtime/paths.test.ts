import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  getEnvPath,
  getMemoryDir,
  getMiniHarnessRoot,
  getSessionDbPath,
  getSkillsDir,
} from "./paths.js";

describe("mini-harness paths", () => {
  const cwd = "/tmp/work";

  it("resolves workspace store paths under .mini-harness", () => {
    assert.equal(getMiniHarnessRoot(cwd), join(cwd, ".mini-harness"));
    assert.equal(getEnvPath(cwd), join(cwd, ".mini-harness", ".env"));
    assert.equal(getSessionDbPath(cwd), join(cwd, ".mini-harness", "sessions.db"));
    assert.equal(getSkillsDir(cwd), join(cwd, ".mini-harness", "skills"));
    assert.equal(getMemoryDir(cwd), join(cwd, ".mini-harness", "memory"));
  });
});
