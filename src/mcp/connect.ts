import { MOCK_MCP_SERVERS, listMockMcpServerNames } from "./mock-servers.js";
import {
  getMcpClients,
  hasMcpClient,
  listConnectedMcpClientNames,
  setMcpClient,
} from "./state.js";

export function connectMcp(name: string): string {
  if (hasMcpClient(name)) {
    return `MCP server '${name}' already connected`;
  }

  const factory = MOCK_MCP_SERVERS[name];
  if (!factory) {
    return `Unknown server '${name}'. Available: ${listMockMcpServerNames().join(", ")}`;
  }

  const server = factory();
  setMcpClient(name, server);
  const toolNames = server.tools.map((tool) => tool.name).join(", ");
  process.stdout.write(`\x1b[90m  [mcp] connected: ${name} -> ${toolNames}\x1b[0m\n`);
  return `Connected to MCP server '${name}'. Discovered ${server.tools.length} tools: ${toolNames}`;
}

export function listConnectedMcpServers(): string[] {
  return listConnectedMcpClientNames();
}

export { listMockMcpServerNames };
