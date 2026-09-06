import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isSubagentContext, withSubagentContext } from "./context.js";

describe("subagent context", () => {
  it("starts inactive outside subagent runs", () => {
    assert.equal(isSubagentContext(), false);
  });

  it("tracks nested withSubagentContext depth", async () => {
    await withSubagentContext(async () => {
      assert.equal(isSubagentContext(), true);
      await withSubagentContext(async () => {
        assert.equal(isSubagentContext(), true);
      });
      assert.equal(isSubagentContext(), true);
    });
    assert.equal(isSubagentContext(), false);
  });
});
