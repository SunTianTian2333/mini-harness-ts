import type { McpConnection } from "./connection.js";

const connections = new Map<string, McpConnection>();

export function getMcpConnections(): Map<string, McpConnection> {
  return connections;
}

export function setMcpConnection(name: string, connection: McpConnection): void {
  connections.set(name, connection);
}

export function hasMcpConnection(name: string): boolean {
  return connections.has(name);
}

export function listConnectedMcpConnectionNames(): string[] {
  return [...connections.keys()].sort();
}

export function resetMcpConnections(): void {
  connections.clear();
}
