export type McpToolPolicy = "allow" | "confirm";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type McpToolHandler = (args: Record<string, unknown>) => string;

export type AssembledToolPool = {
  tools: import("../runtime/types.js").ChatTool[];
  execute: (name: string, args: Record<string, unknown>, cwd: string) => Promise<string>;
};
