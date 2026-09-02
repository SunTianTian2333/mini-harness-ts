import { runBash, BASH_TOOL } from "./bash.js";
import {
  runRead,
  runWrite,
  runEdit,
  runGlob,
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  EDIT_FILE_TOOL,
  GLOB_TOOL,
} from "./file.js";
import { runTodoWrite, TODO_WRITE_TOOL } from "./todo.js";
import { runLoadSkill, LOAD_SKILL_TOOL } from "./skill.js";
import { COMPACT_TOOL, runCompact } from "./compact.js";
import { CONNECT_MCP_TOOL } from "./connect-mcp.js";

import type { ChatTool } from "../runtime/types.js";

export const BUILTIN_TOOL_SCHEMAS: ChatTool[] = [
  BASH_TOOL,
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  EDIT_FILE_TOOL,
  GLOB_TOOL,
  TODO_WRITE_TOOL,
  LOAD_SKILL_TOOL,
  COMPACT_TOOL,
  CONNECT_MCP_TOOL,
];
