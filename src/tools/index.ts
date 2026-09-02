export { runBash } from "./bash.js";
export { runRead, runWrite, runEdit, runGlob, safePath } from "./file.js";
export { runTodoWrite } from "./todo.js";
export { runLoadSkill } from "./skill.js";
export { BUILTIN_TOOL_SCHEMAS } from "./schemas.js";
export { executeBuiltinTool } from "./builtin.js";
export { CONNECT_MCP_TOOL } from "./connect-mcp.js";

import { assembleToolPool } from "../mcp/registry.js";

export { assembleToolPool } from "../mcp/registry.js";

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<string> {
  return assembleToolPool().execute(name, args, cwd);
}

/** Static snapshot without connected MCP tools; prefer assembleToolPool() each turn. */
export const TOOL_SCHEMAS: import("../runtime/types.js").ChatTool[] = assembleToolPool().tools;
