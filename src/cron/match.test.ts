import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cronMatches, minuteMarker } from "./match.js";

describe("cronMatches", () => {
  it("matches daily 09:00 jobs", () => {
    const nineAm = new Date(2026, 8, 6, 9, 0, 0);
    assert.equal(cronMatches("0 9 * * *", nineAm), true);
    assert.equal(cronMatches("0 9 * * *", new Date(2026, 8, 6, 10, 0, 0)), false);
  });

  it("matches every-five-minute schedules", () => {
    assert.equal(cronMatches("*/5 * * * *", new Date(2026, 8, 6, 12, 10, 0)), true);
    assert.equal(cronMatches("*/5 * * * *", new Date(2026, 8, 6, 12, 11, 0)), false);
  });

  it("formats minute markers", () => {
    assert.equal(minuteMarker(new Date(2026, 8, 6, 9, 5, 30)), "2026-09-06 09:05");
  });
});
