import { executeBuiltinTool } from "../tools/builtin.js";
import { BUILTIN_TOOL_SCHEMAS } from "../tools/schemas.js";
import type { AssembledToolPool } from "../mcp/types.js";
import { SUBAGENT_TOOL_NAMES } from "./types.js";

export function assembleSubagentToolPool(): AssembledToolPool {
  const tools = BUILTIN_TOOL_SCHEMAS.filter((tool) =>
    SUBAGENT_TOOL_NAMES.has(tool.function.name),
  ).map((tool) => structuredClone(tool));

  return {
    tools,
    async execute(name, args, cwd) {
      if (!SUBAGENT_TOOL_NAMES.has(name)) {
        return `Error: Unknown tool "${name}"`;
      }
      return executeBuiltinTool(name, args, cwd);
    },
  };
}
