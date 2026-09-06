import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatScheduledPrompt } from "./format.js";

describe("formatScheduledPrompt", () => {
  it("prefixes scheduled prompts for harness injection", () => {
    assert.equal(formatScheduledPrompt("run date"), "[Scheduled] run date");
  });
});
