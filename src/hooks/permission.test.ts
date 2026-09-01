import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkDenyList,
  checkRules,
  containsDestructiveCommand,
  createPermissionHook,
  pathEscapesWorkspace,
} from "./permission.js";

describe("permission helpers", () => {
  const workdir = "/tmp/work";

  it("blocks deny list commands", () => {
    assert.match(checkDenyList("sudo rm -rf /") ?? "", /deny list/);
    assert.equal(checkDenyList("echo hello"), null);
  });

  it("flags destructive bash commands", () => {
    assert.equal(containsDestructiveCommand("rm -rf ./tmp"), true);
    assert.equal(containsDestructiveCommand("echo hello"), false);
  });

  it("detects file paths outside workspace", () => {
    assert.equal(pathEscapesWorkspace("src/main.ts", workdir), false);
    assert.equal(pathEscapesWorkspace("../../../etc/passwd", workdir), true);
  });

  it("checkRules returns reasons for risky tools", () => {
    assert.equal(checkRules("read_file", { path: "../../../etc/passwd" }, workdir), "Path outside workspace");
    assert.equal(checkRules("bash", { command: "rm -rf ./data" }, workdir), "Potentially destructive command");
    assert.equal(checkRules("glob", { pattern: "**/*.ts" }, workdir), null);
  });
});

describe("createPermissionHook", () => {
  it("hard-blocks deny list without prompting", async () => {
    const hook = createPermissionHook("/tmp/work");
    const result = await hook({
      id: "1",
      name: "bash",
      input: { command: "sudo ls" },
    });
    assert.equal(result, "Permission denied.");
  });

  it("allows safe bash commands", async () => {
    const hook = createPermissionHook("/tmp/work");
    const result = await hook({
      id: "1",
      name: "bash",
      input: { command: "echo ok" },
    });
    assert.equal(result, null);
  });
});
