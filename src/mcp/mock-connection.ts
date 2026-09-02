import { MCPClient } from "./client.js";
import type { McpConnection } from "./connection.js";
import type { McpToolDefinition, McpToolPolicy } from "./types.js";

export class MockMcpConnection implements McpConnection {
  readonly kind = "mock" as const;

  constructor(
    readonly name: string,
    private readonly client: MCPClient,
    toolPolicies: Record<string, McpToolPolicy> = {},
  ) {
    this.toolPolicies = new Map(Object.entries(toolPolicies));
  }

  readonly toolPolicies: ReadonlyMap<string, McpToolPolicy>;

  listTools(): McpToolDefinition[] {
    return this.client.tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.client.callTool(toolName, args);
  }

  async close(): Promise<void> {
    // Mock connections are in-process; nothing to tear down in P10b-1.
  }
}

export function createMockMcpConnection(
  name: string,
  factory: () => MCPClient,
  toolPolicies: Record<string, McpToolPolicy> = {},
): MockMcpConnection {
  return new MockMcpConnection(name, factory(), toolPolicies);
}
