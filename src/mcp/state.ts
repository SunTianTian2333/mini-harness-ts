import type { MCPClient } from "./client.js";

const clients = new Map<string, MCPClient>();

export function getMcpClients(): Map<string, MCPClient> {
  return clients;
}

export function setMcpClient(name: string, client: MCPClient): void {
  clients.set(name, client);
}

export function hasMcpClient(name: string): boolean {
  return clients.has(name);
}

export function listConnectedMcpClientNames(): string[] {
  return [...clients.keys()].sort();
}

export function resetMcpClients(): void {
  clients.clear();
}
