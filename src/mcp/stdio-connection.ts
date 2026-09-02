import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import type { StdioMcpServerConfig } from "./config.js";
import type { McpConnection } from "./connection.js";
import type { McpToolDefinition, McpToolPolicy } from "./types.js";

function assertObjectSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }
  const record = schema as Record<string, unknown>;
  if (record.type !== undefined && record.type !== "object") {
    return { type: "object", properties: {} };
  }
  return record;
}

function formatCallToolResult(result: {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
}): string {
  if (Array.isArray(result.content)) {
    const parts: string[] = [];
    for (const block of result.content) {
      if (block && typeof block === "object" && "type" in block) {
        const typed = block as { type: string; text?: string };
        if (typed.type === "text" && typeof typed.text === "string") {
          parts.push(typed.text);
          continue;
        }
      }
      parts.push(JSON.stringify(block));
    }
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent, null, 2);
  }

  return JSON.stringify(result);
}

function mapTool(tool: {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: unknown;
}): McpToolDefinition {
  return {
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: assertObjectSchema(tool.inputSchema),
    ...(tool.annotations && typeof tool.annotations === "object" && !Array.isArray(tool.annotations)
      ? { annotations: tool.annotations as Record<string, unknown> }
      : {}),
  };
}

export class StdioMcpConnection implements McpConnection {
  readonly kind = "stdio" as const;
  readonly toolPolicies: ReadonlyMap<string, McpToolPolicy>;
  private readonly tools: McpToolDefinition[];
  private closed = false;

  constructor(
    readonly name: string,
    private readonly client: Client,
    private readonly transport: StdioClientTransport,
    tools: McpToolDefinition[],
    toolPolicies: Record<string, McpToolPolicy> = {},
  ) {
    this.tools = tools;
    this.toolPolicies = new Map(Object.entries(toolPolicies));
  }

  listTools(): McpToolDefinition[] {
    return this.tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.client.callTool({ name: toolName, arguments: args });
      const text = formatCallToolResult(result);
      if (result.isError) {
        return `MCP error: ${text}`;
      }
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const type = error instanceof Error ? error.constructor.name : "Error";
      return `MCP error: ${type}: ${message}`;
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.client.close().catch(() => {});
  }
}

async function teardownStdioClient(client: Client, transport: StdioClientTransport): Promise<void> {
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
}

export async function createStdioMcpConnection(
  name: string,
  config: StdioMcpServerConfig,
  workspaceCwd: string,
): Promise<StdioMcpConnection> {
  const client = new Client({ name: "mini-harness-ts", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    ...(config.args ? { args: config.args } : {}),
    ...(config.env ? { env: config.env } : {}),
    cwd: config.cwd ?? workspaceCwd,
    stderr: "inherit",
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return new StdioMcpConnection(name, client, transport, tools.map(mapTool), config.policy ?? {});
  } catch (error) {
    await teardownStdioClient(client, transport);
    throw error;
  }
}
