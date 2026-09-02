import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildMcpToolName, isMcpToolName, normalizeMcpName } from "./names.js";
import { getMcpToolPolicy, hostPolicyFor } from "./policy.js";
import { assembleToolPool, connectMcp, resetMcpRegistrySync } from "./registry.js";

describe("mcp names", () => {
  it("normalizes unsafe characters", () => {
    assert.equal(normalizeMcpName("docs-v2"), "docs-v2");
    assert.equal(normalizeMcpName("a/b"), "a_b");
  });

  it("builds prefixed tool names", () => {
    assert.equal(buildMcpToolName("docs", "search"), "mcp__docs__search");
    assert.equal(isMcpToolName("mcp__docs__search"), true);
    assert.equal(isMcpToolName("bash"), false);
  });
});

describe("mcp registry", () => {
  beforeEach(() => {
    resetMcpRegistrySync();
  });

  it("connects mock servers and exposes prefixed tools on next assemble", async () => {
    const before = assembleToolPool();
    assert.equal(before.tools.some((tool) => tool.function.name === "mcp__docs__search"), false);

    const message = await connectMcp("docs");
    assert.match(message, /Connected to MCP server 'docs'/);

    const after = assembleToolPool();
    const names = after.tools.map((tool) => tool.function.name);
    assert.ok(names.includes("connect_mcp"));
    assert.ok(names.includes("mcp__docs__search"));
    assert.ok(names.includes("mcp__docs__get_version"));
  });

  it("executes allowlisted MCP tools", async () => {
    await connectMcp("docs");
    const pool = assembleToolPool();
    assert.equal(hostPolicyFor("docs", "search"), "allow");
    assert.equal(getMcpToolPolicy("mcp__docs__search"), "allow");

    const output = await pool.execute("mcp__docs__search", { query: "agent loop" }, "/tmp");
    assert.match(output, /Found 3 results/);
  });

  it("marks unknown MCP tools as confirm policy", async () => {
    await connectMcp("deploy");
    assembleToolPool();
    assert.equal(getMcpToolPolicy("mcp__deploy__trigger"), "confirm");
    assert.equal(getMcpToolPolicy("mcp__deploy__status"), "allow");
  });

  it("rejects duplicate connect", async () => {
    await connectMcp("docs");
    assert.match(await connectMcp("docs"), /already connected/);
  });
});
