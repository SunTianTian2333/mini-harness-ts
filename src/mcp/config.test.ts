import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  autoConnectConfiguredMcpServers,
  connectMcp,
  listAvailableMcpServerNames,
  listConnectedMcpServers,
  setMcpWorkspaceCwd,
  shutdownMcpConnections,
} from "./connect.js";
import { loadMcpServersConfig, parseMcpServersFile } from "./config.js";
import type { McpConnection } from "./connection.js";
import { getMcpToolPolicy } from "./policy.js";
import { assembleToolPool, resetMcpRegistrySync } from "./registry.js";
import { setMcpConnection } from "./state.js";
import type { McpToolPolicy } from "./types.js";
import { MINI_HARNESS_DIR } from "../runtime/paths.js";

const echoServerPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/echo-mcp-server.mjs");

function workspaceRoot(cwd: string): string {
  return join(cwd, MINI_HARNESS_DIR);
}

describe("mcp config", () => {
  it("parses mock and stdio server entries", () => {
    const parsed = parseMcpServersFile({
      servers: {
        docs: { transport: "mock" },
        music: {
          transport: "stdio",
          command: "python",
          args: ["-m", "music_mcp"],
          policy: { validate_composition: "allow" },
        },
      },
      autoConnect: ["music"],
    });

    assert.equal(parsed.servers?.docs?.transport, "mock");
    assert.equal(parsed.servers?.music?.transport, "stdio");
    assert.deepEqual(parsed.autoConnect, ["music"]);
  });

  it("loads config from .mini-harness/mcp-servers.json", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-config-"));
    mkdirSync(workspaceRoot(root), { recursive: true });
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          docs: { transport: "mock", policy: { search: "allow" } },
        },
      }),
      "utf-8",
    );

    const config = loadMcpServersConfig(root);
    assert.equal(config.servers?.docs?.transport, "mock");
  });

  it("returns empty config when mcp-servers.json is invalid JSON", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-config-bad-"));
    mkdirSync(workspaceRoot(root), { recursive: true });
    writeFileSync(join(workspaceRoot(root), "mcp-servers.json"), "{ not json", "utf-8");

    const config = loadMcpServersConfig(root);
    assert.deepEqual(config, { servers: {}, autoConnect: [] });
  });

  it("skips stdio servers with empty command instead of crashing", () => {
    const parsed = parseMcpServersFile({
      servers: {
        bad: { transport: "stdio", command: "" },
        good: { transport: "stdio", command: "node" },
      },
    });

    assert.equal(parsed.servers?.bad, undefined);
    assert.equal(parsed.servers?.good?.transport, "stdio");
  });
});

describe("connect with config", () => {
  let root: string;

  beforeEach(async () => {
    await shutdownMcpConnections();
    resetMcpRegistrySync();
    root = mkdtempSync(join(tmpdir(), "mcp-connect-"));
    mkdirSync(workspaceRoot(root), { recursive: true });
    setMcpWorkspaceCwd(root);
  });

  afterEach(async () => {
    await shutdownMcpConnections();
  });

  it("lists configured stdio servers and built-in mock names only", () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          piano: { transport: "mock" },
          music: { transport: "stdio", command: "python", args: ["-m", "music_mcp"] },
        },
      }),
      "utf-8",
    );

    const names = listAvailableMcpServerNames(root);
    assert.ok(names.includes("music"));
    assert.ok(!names.includes("piano"));
    assert.ok(names.includes("docs"));
  });

  it("connects mock server declared only in config when named docs", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          docs: { transport: "mock", policy: { search: "allow" } },
        },
      }),
      "utf-8",
    );

    assert.match(await connectMcp("docs", root), /Connected to MCP server 'docs'/);
    assembleToolPool();
    assert.equal(getMcpToolPolicy("mcp__docs__search"), "allow");
  });

  it("connects stdio MCP server from config and executes echo tool", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          echo: {
            transport: "stdio",
            command: process.execPath,
            args: [echoServerPath],
          },
        },
      }),
      "utf-8",
    );

    assert.match(await connectMcp("echo", root), /Connected to MCP server 'echo'/);
    const pool = assembleToolPool();
    const output = await pool.execute("mcp__echo__echo", { message: "hello" }, root);
    assert.equal(output, "hello");
  });
});

describe("autoConnect", () => {
  let root: string;

  beforeEach(async () => {
    await shutdownMcpConnections();
    resetMcpRegistrySync();
    root = mkdtempSync(join(tmpdir(), "mcp-autoconnect-"));
    mkdirSync(workspaceRoot(root), { recursive: true });
    setMcpWorkspaceCwd(root);
  });

  afterEach(async () => {
    await shutdownMcpConnections();
  });

  it("connects mock servers listed in autoConnect", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          docs: { transport: "mock" },
        },
        autoConnect: ["docs"],
      }),
      "utf-8",
    );

    const result = await autoConnectConfiguredMcpServers(root);
    assert.deepEqual(result.connected, ["docs"]);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(listConnectedMcpServers(), ["docs"]);
    assert.ok(assembleToolPool().tools.some((tool) => tool.function.name === "mcp__docs__search"));
  });

  it("connects stdio servers listed in autoConnect", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          echo: {
            transport: "stdio",
            command: process.execPath,
            args: [echoServerPath],
          },
        },
        autoConnect: ["echo"],
      }),
      "utf-8",
    );

    const result = await autoConnectConfiguredMcpServers(root);
    assert.deepEqual(result.connected, ["echo"]);
    assert.deepEqual(result.failures, []);
    assert.ok(assembleToolPool().tools.some((tool) => tool.function.name === "mcp__echo__echo"));
  });

  it("records failures for unknown autoConnect entries without throwing", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({ autoConnect: ["missing-server"] }),
      "utf-8",
    );

    const result = await autoConnectConfiguredMcpServers(root);
    assert.deepEqual(result.connected, []);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.name, "missing-server");
    assert.match(result.failures[0]?.message ?? "", /Unknown server/);
  });

  it("throws when strict mode is enabled and autoConnect fails", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({ autoConnect: ["missing-server"] }),
      "utf-8",
    );

    await assert.rejects(
      () => autoConnectConfiguredMcpServers(root, { strict: true }),
      /autoConnect failed for 'missing-server'/,
    );
  });

  it("rolls back partial autoConnect when strict mode fails", async () => {
    writeFileSync(
      join(workspaceRoot(root), "mcp-servers.json"),
      JSON.stringify({
        servers: {
          docs: { transport: "mock" },
        },
        autoConnect: ["docs", "missing-server"],
      }),
      "utf-8",
    );

    await assert.rejects(
      () => autoConnectConfiguredMcpServers(root, { strict: true }),
      /autoConnect failed for 'missing-server'/,
    );
    assert.deepEqual(listConnectedMcpServers(), []);
  });
});

describe("mcp lifecycle", () => {
  beforeEach(async () => {
    await shutdownMcpConnections();
    resetMcpRegistrySync();
  });

  afterEach(async () => {
    await shutdownMcpConnections();
  });

  it("clears registry even when a connection close fails", async () => {
    class FailingCloseConnection implements McpConnection {
      readonly name = "fail";
      readonly kind = "mock" as const;
      readonly toolPolicies = new Map<string, McpToolPolicy>();

      listTools() {
        return [];
      }

      async callTool(): Promise<string> {
        return "";
      }

      async close(): Promise<void> {
        throw new Error("close failed");
      }
    }

    setMcpConnection("fail", new FailingCloseConnection());
    await shutdownMcpConnections();
    assert.deepEqual(listConnectedMcpServers(), []);
  });
});
