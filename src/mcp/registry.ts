import type { ChatTool } from "../runtime/types.js";
import { buildMcpToolName, normalizeMcpName } from "./names.js";
import { resetActiveMcpToolPolicies, resolveToolPolicy, setActiveMcpToolPolicies } from "./policy.js";
import { getMcpConnections, resetMcpConnections } from "./state.js";
import type { AssembledToolPool, McpToolPolicy } from "./types.js";
import { BUILTIN_TOOL_SCHEMAS } from "../tools/schemas.js";
import { executeBuiltinTool } from "../tools/builtin.js";
import { connectMcp, getMcpWorkspaceCwd, shutdownMcpConnections } from "./connect.js";

function assertObjectSchema(schema: unknown, origin: string): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Invalid input schema for ${origin}`);
  }
  const record = schema as Record<string, unknown>;
  if (record.type !== undefined && record.type !== "object") {
    throw new Error(`Invalid input schema for ${origin}`);
  }
  return record;
}

export async function resetMcpRegistry(): Promise<void> {
  await shutdownMcpConnections();
  resetActiveMcpToolPolicies();
}

/** @deprecated Use resetMcpRegistry() */
export function resetMcpRegistrySync(): void {
  resetMcpConnections();
  resetActiveMcpToolPolicies();
}

export function assembleToolPool(): AssembledToolPool {
  const tools: ChatTool[] = BUILTIN_TOOL_SCHEMAS.map((tool) => structuredClone(tool));
  const policies = new Map<string, McpToolPolicy>();
  const origins = new Map<string, string>();

  for (const tool of tools) {
    origins.set(tool.function.name, `built-in tool '${tool.function.name}'`);
  }

  const executors = new Map<
    string,
    (args: Record<string, unknown>, cwd: string) => Promise<string>
  >();

  for (const tool of tools) {
    const toolName = tool.function.name;
    if (toolName === "connect_mcp") {
      executors.set(toolName, async (args) => {
        const name = args.name;
        if (typeof name !== "string" || name.trim().length === 0) {
          return "Error: connect_mcp requires name";
        }
        return connectMcp(name.trim(), getMcpWorkspaceCwd());
      });
      continue;
    }
    executors.set(toolName, (args, cwd) => executeBuiltinTool(toolName, args, cwd));
  }

  for (const [serverName, connection] of getMcpConnections()) {
    const safeServer = normalizeMcpName(serverName);
    for (const toolDef of connection.listTools()) {
      const rawName = toolDef.name;
      const safeTool = normalizeMcpName(rawName);
      const prefixed = buildMcpToolName(safeServer, safeTool);
      const origin = `MCP tool '${serverName}/${rawName}'`;

      if (origins.has(prefixed)) {
        throw new Error(
          `MCP tool name collision after normalization: '${prefixed}' maps both ${origins.get(prefixed)} and ${origin}`,
        );
      }

      const schema = assertObjectSchema(toolDef.inputSchema, origin);
      origins.set(prefixed, origin);
      policies.set(prefixed, resolveToolPolicy(serverName, rawName, connection.toolPolicies));

      tools.push({
        type: "function",
        function: {
          name: prefixed,
          description: toolDef.description,
          parameters: schema,
        },
      });

      executors.set(prefixed, async (args) => connection.callTool(rawName, args));
    }
  }

  setActiveMcpToolPolicies(policies);

  return {
    tools,
    async execute(name, args, cwd) {
      const handler = executors.get(name);
      if (!handler) {
        return `Error: Unknown tool "${name}"`;
      }
      return handler(args, cwd);
    },
  };
}

export {
  autoConnectConfiguredMcpServers,
  connectMcp,
  listConnectedMcpServers,
  listAvailableMcpServerNames,
  setMcpWorkspaceCwd,
} from "./connect.js";
export { loadMcpServersConfig } from "./config.js";
export { listMockMcpServerNames } from "./mock-servers.js";
