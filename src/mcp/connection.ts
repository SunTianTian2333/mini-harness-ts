import type { McpToolDefinition, McpToolPolicy } from "./types.js";

export type McpConnectionKind = "mock" | "stdio";

export interface McpConnection {
  readonly name: string;
  readonly kind: McpConnectionKind;
  readonly toolPolicies: ReadonlyMap<string, McpToolPolicy>;

  listTools(): McpToolDefinition[];
  callTool(toolName: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}
