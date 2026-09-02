import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createPermissionHook } from "../hooks/permission.js";
import {
  clearPromptFn,
  getPromptBusyReason,
  promptUser,
  setPromptFn,
} from "./prompt-io.js";

describe("prompt-io", () => {
  it("tracks busy reason during promptUser", async () => {
    setPromptFn(async () => "ok");
    assert.equal(getPromptBusyReason(), null);
    const pending = promptUser("label", "permission");
    assert.equal(getPromptBusyReason(), "permission");
    await pending;
    assert.equal(getPromptBusyReason(), null);
    clearPromptFn();
  });

  it("supports sequential prompts after permission flow", async () => {
    const inputs = ["y", "hello"];
    setPromptFn(async () => inputs.shift() ?? "");

    const hook = createPermissionHook("/tmp/work");
    const result = await hook({
      id: "1",
      name: "bash",
      input: { command: "rm -rf ./data" },
    });
    assert.equal(result, null);

    const next = await promptUser("p6 >> ");
    assert.equal(next, "hello");
    clearPromptFn();
  });
});
