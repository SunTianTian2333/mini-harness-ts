import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { assembleToolPool } from "../mcp/registry.js";
import { assembleSubagentToolPool } from "./tool-pool.js";
import { SUBAGENT_TOOL_NAMES } from "./types.js";

describe("assembleSubagentToolPool", () => {
  it("includes only base file/bash tools", () => {
    const pool = assembleSubagentToolPool();
    const names = pool.tools.map((tool) => tool.function.name).sort();

    assert.deepEqual(names, [...SUBAGENT_TOOL_NAMES].sort());
  });

  it("parent pool includes run_subagent while sub pool does not", () => {
    const parent = assembleToolPool();
    const sub = assembleSubagentToolPool();

    assert.ok(parent.tools.some((tool) => tool.function.name === "run_subagent"));
    assert.ok(!sub.tools.some((tool) => tool.function.name === "run_subagent"));
    assert.ok(!sub.tools.some((tool) => tool.function.name === "create_task"));
    assert.ok(!sub.tools.some((tool) => tool.function.name === "connect_mcp"));
  });

  it("rejects unknown tools in sub pool execute", async () => {
    const pool = assembleSubagentToolPool();
    const output = await pool.execute("run_subagent", { prompt: "x" }, "/tmp");
    assert.match(output, /Unknown tool/);
  });
});
