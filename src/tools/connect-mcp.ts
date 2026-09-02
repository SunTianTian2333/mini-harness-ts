import type { ChatTool } from "../runtime/types.js";

export const CONNECT_MCP_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "connect_mcp",
    description:
      "Connect to an MCP server and discover its tools. Use a name from .mini-harness/mcp-servers.json or a built-in mock server (docs, deploy).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "MCP server alias or mock server name",
        },
      },
      required: ["name"],
    },
  },
};
