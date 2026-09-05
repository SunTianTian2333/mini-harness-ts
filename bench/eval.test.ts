import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { parseOutput, scoreEventQa } from "./mab/eval.js";

describe("bench/mab/eval", () => {
  it("scoreEventQa matches gold substring", () => {
    const gold = "Debbie wore a new green flowered-muslin dress that matched her slippers.";
    const scored = scoreEventQa(gold, [gold]);
    assert.equal(scored.substring_exact_match, true);
    assert.equal(scored.eventqa_recall, 1);
  });

  it("parseOutput strips quotes", () => {
    assert.equal(parseOutput('"hello world"'), "hello world");
  });

  it("scoreEventQa fails on wrong answer", () => {
    const scored = scoreEventQa("something else entirely", ["expected answer"]);
    assert.equal(scored.substring_exact_match, false);
  });
});
