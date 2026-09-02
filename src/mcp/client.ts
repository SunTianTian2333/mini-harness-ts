import type { McpToolDefinition, McpToolHandler } from "./types.js";

export class MCPClient {
  readonly name: string;
  tools: McpToolDefinition[] = [];
  private handlers = new Map<string, McpToolHandler>();

  constructor(name: string) {
    this.name = name;
  }

  register(toolDefs: McpToolDefinition[], handlers: Record<string, McpToolHandler>): void {
    const names = toolDefs.map((tool) => tool.name);
    if (names.some((name) => !name)) {
      throw new Error("Every MCP tool needs a non-empty name");
    }
    if (new Set(names).size !== names.length) {
      throw new Error(`Duplicate MCP tool name on server ${this.name}`);
    }

    const missing = names.filter((name) => !(name in handlers));
    if (missing.length > 0) {
      throw new Error(`Missing MCP handlers: ${missing.join(", ")}`);
    }

    this.tools = [...toolDefs];
    this.handlers = new Map(Object.entries(handlers));
  }

  callTool(toolName: string, args: Record<string, unknown>): string {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      return `MCP error: unknown tool '${toolName}'`;
    }
    try {
      return handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const type = error instanceof Error ? error.constructor.name : "Error";
      return `MCP error: ${type}: ${message}`;
    }
  }
}
