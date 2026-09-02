import type { ChatTool } from "../runtime/types.js";

export const CONNECT_MCP_SERVER_NAMES = ["docs", "deploy"] as const;

export const CONNECT_MCP_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "connect_mcp",
    description: "Connect to an MCP server and discover its tools.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: [...CONNECT_MCP_SERVER_NAMES],
          description: "Mock MCP server name to connect",
        },
      },
      required: ["name"],
    },
  },
};
