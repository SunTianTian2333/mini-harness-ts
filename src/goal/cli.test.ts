import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { parseGoalCommand } from "./cli.js";
import { resetGoalControllerForTests } from "./singleton.js";

describe("parseGoalCommand", () => {
  beforeEach(() => {
    resetGoalControllerForTests();
  });

  it("returns handled false for normal input", () => {
    assert.deepEqual(parseGoalCommand("hello"), { handled: false });
  });

  it("does not treat /goalkeeper as a goal command", () => {
    assert.deepEqual(parseGoalCommand("/goalkeeper"), { handled: false });
  });

  it("shows status for bare /goal", () => {
    const result = parseGoalCommand("/goal");
    assert.equal(result.handled, true);
    if (result.handled) {
      assert.match(result.output, /No goal set/);
      assert.equal(result.beginQuery, false);
    }
  });

  it("shows status for /goal with trailing space", () => {
    const result = parseGoalCommand("/goal   ");
    assert.equal(result.handled, true);
    if (result.handled) {
      assert.match(result.output, /No goal set/);
      assert.equal(result.beginQuery, false);
    }
  });

  it("clears with aliases", () => {
    parseGoalCommand("/goal tests pass");
    const cleared = parseGoalCommand("/goal clear");
    assert.equal(cleared.handled, true);
    if (cleared.handled) {
      assert.match(cleared.output, /Goal cleared/);
      assert.equal(cleared.beginQuery, false);
    }
  });

  it("sets goal and auto-starts", () => {
    const result = parseGoalCommand("/goal npm test passes");
    assert.equal(result.handled, true);
    if (result.handled) {
      assert.match(result.output, /Goal set/);
      assert.equal(result.autoStart, "npm test passes");
      assert.equal(result.beginQuery, true);
    }
  });
});
