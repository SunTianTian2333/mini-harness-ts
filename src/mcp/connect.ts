import { getConfiguredMcpServer, loadMcpServersConfig, type StdioMcpServerConfig } from "./config.js";
import { createMockMcpConnection } from "./mock-connection.js";
import { MOCK_MCP_SERVERS, listMockMcpServerNames } from "./mock-servers.js";
import { createStdioMcpConnection } from "./stdio-connection.js";
import {
  getMcpConnections,
  hasMcpConnection,
  listConnectedMcpConnectionNames,
  resetMcpConnections,
  setMcpConnection,
} from "./state.js";

let workspaceCwd = process.cwd();

export function setMcpWorkspaceCwd(cwd: string): void {
  workspaceCwd = cwd;
}

export function getMcpWorkspaceCwd(): string {
  return workspaceCwd;
}

export function listAvailableMcpServerNames(cwd = workspaceCwd): string[] {
  const configured = Object.entries(loadMcpServersConfig(cwd).servers ?? {})
    .filter(([name, server]) => {
      if (server.transport === "stdio") {
        return true;
      }
      return server.transport === "mock" && name in MOCK_MCP_SERVERS;
    })
    .map(([name]) => name);
  const legacy = listMockMcpServerNames();
  return [...new Set([...configured, ...legacy])].sort();
}

function connectMockServer(name: string, policy?: Record<string, import("./types.js").McpToolPolicy>): string {
  const factory = MOCK_MCP_SERVERS[name];
  if (!factory) {
    return `Unknown mock MCP server '${name}'. Available: ${listAvailableMcpServerNames().join(", ")}`;
  }

  const connection = createMockMcpConnection(name, factory, policy);
  setMcpConnection(name, connection);
  const toolNames = connection.listTools().map((tool) => tool.name).join(", ");
  process.stdout.write(`\x1b[90m  [mcp] connected: ${name} -> ${toolNames}\x1b[0m\n`);
  return `Connected to MCP server '${name}'. Discovered ${connection.listTools().length} tools: ${toolNames}`;
}

async function connectStdioServer(
  name: string,
  config: StdioMcpServerConfig,
  cwd: string,
): Promise<string> {
  try {
    const connection = await createStdioMcpConnection(name, config, cwd);
    setMcpConnection(name, connection);
    const toolNames = connection.listTools().map((tool) => tool.name).join(", ");
    process.stdout.write(`\x1b[90m  [mcp] connected: ${name} -> ${toolNames}\x1b[0m\n`);
    return `Connected to MCP server '${name}'. Discovered ${connection.listTools().length} tools: ${toolNames}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: failed to connect MCP server '${name}': ${message}`;
  }
}

export async function connectMcp(name: string, cwd = workspaceCwd): Promise<string> {
  if (hasMcpConnection(name)) {
    return `MCP server '${name}' already connected`;
  }

  const configured = getConfiguredMcpServer(cwd, name);
  if (configured) {
    if (configured.transport === "mock") {
      return connectMockServer(name, configured.policy);
    }
    return connectStdioServer(name, configured, cwd);
  }

  if (name in MOCK_MCP_SERVERS) {
    return connectMockServer(name);
  }

  return `Unknown server '${name}'. Available: ${listAvailableMcpServerNames(cwd).join(", ")}`;
}

export function listConnectedMcpServers(): string[] {
  return listConnectedMcpConnectionNames();
}

export type AutoConnectResult = {
  connected: string[];
  skipped: string[];
  failures: Array<{ name: string; message: string }>;
};

export async function autoConnectConfiguredMcpServers(
  cwd = workspaceCwd,
  options: { strict?: boolean } = {},
): Promise<AutoConnectResult> {
  const config = loadMcpServersConfig(cwd);
  const connected: string[] = [];
  const skipped: string[] = [];
  const failures: Array<{ name: string; message: string }> = [];

  try {
    for (const name of [...new Set(config.autoConnect ?? [])]) {
      if (hasMcpConnection(name)) {
        skipped.push(name);
        continue;
      }

      const message = await connectMcp(name, cwd);
      if (message.startsWith("Connected to MCP server")) {
        connected.push(name);
        continue;
      }

      failures.push({ name, message });
      process.stderr.write(`\x1b[33m[mcp] autoConnect '${name}' failed: ${message}\x1b[0m\n`);
      if (options.strict) {
        throw new Error(`autoConnect failed for '${name}': ${message}`);
      }
    }

    return { connected, skipped, failures };
  } catch (error) {
    await shutdownMcpConnections();
    throw error;
  }
}

export async function shutdownMcpConnections(): Promise<void> {
  const closing = [...getMcpConnections().values()];
  if (closing.length === 0) {
    return;
  }

  await Promise.allSettled(closing.map((connection) => connection.close()));
  resetMcpConnections();
}

export { listMockMcpServerNames };
