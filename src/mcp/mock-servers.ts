import { MCPClient } from "./client.js";

function mockServerDocs(): MCPClient {
  const server = new MCPClient("docs");
  server.register(
    [
      {
        name: "search",
        description: "Search the documentation.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: "get_version",
        description: "Get the documentation API version.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
      },
    ],
    {
      search: (args) => {
        const query = typeof args.query === "string" ? args.query : "";
        return `[docs] Found 3 results for '${query}'`;
      },
      get_version: () => "[docs] API v2.1.0",
    },
  );
  return server;
}

function mockServerDeploy(): MCPClient {
  const server = new MCPClient("deploy");
  server.register(
    [
      {
        name: "trigger",
        description: "Trigger a deployment.",
        inputSchema: {
          type: "object",
          properties: { service: { type: "string" } },
          required: ["service"],
        },
        annotations: { destructiveHint: true },
      },
      {
        name: "status",
        description: "Check deployment status.",
        inputSchema: {
          type: "object",
          properties: { service: { type: "string" } },
          required: ["service"],
        },
        annotations: { readOnlyHint: true },
      },
    ],
    {
      trigger: (args) => {
        const service = typeof args.service === "string" ? args.service : "unknown";
        return `[deploy] Triggered: ${service}`;
      },
      status: (args) => {
        const service = typeof args.service === "string" ? args.service : "unknown";
        return `[deploy] ${service}: running (v1.4.2)`;
      },
    },
  );
  return server;
}

export const MOCK_MCP_SERVERS: Record<string, () => MCPClient> = {
  docs: mockServerDocs,
  deploy: mockServerDeploy,
};

export function listMockMcpServerNames(): string[] {
  return Object.keys(MOCK_MCP_SERVERS).sort();
}
