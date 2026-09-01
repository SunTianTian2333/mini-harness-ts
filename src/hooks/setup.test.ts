import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { clearHooks, registerHook, triggerHooks } from "./registry.js";
import { setupDefaultHooks } from "./setup.js";

describe("setupDefaultHooks", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("clears previous hooks before registering defaults", async () => {
    let extraStopCalls = 0;
    registerHook("Stop", () => {
      extraStopCalls += 1;
      return null;
    });

    setupDefaultHooks("/tmp/work");
    setupDefaultHooks("/tmp/work");

    await triggerHooks("Stop", []);
    assert.equal(extraStopCalls, 0);
  });
});
