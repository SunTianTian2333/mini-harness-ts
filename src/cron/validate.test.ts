import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateCron } from "./validate.js";

describe("validateCron", () => {
  it("accepts common five-field expressions", () => {
    assert.equal(validateCron("0 9 * * *"), null);
    assert.equal(validateCron("*/5 * * * *"), null);
    assert.equal(validateCron("0 9 * * 1-5"), null);
  });

  it("rejects wrong field count", () => {
    assert.match(validateCron("* * *") ?? "", /Expected 5 fields/);
  });

  it("rejects out-of-range values", () => {
    assert.match(validateCron("60 * * * *") ?? "", /minute/);
    assert.match(validateCron("* 24 * * *") ?? "", /hour/);
  });
});
