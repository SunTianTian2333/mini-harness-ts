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
import { COMPACT_TOOL } from "./compact.js";

import type { ChatTool } from "../runtime/types.js";

export { runBash } from "./bash.js";
export { runRead, runWrite, runEdit, runGlob, safePath } from "./file.js";
export { runTodoWrite } from "./todo.js";
export { runLoadSkill } from "./skill.js";

export const TOOL_SCHEMAS: ChatTool[] = [
  BASH_TOOL,
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  EDIT_FILE_TOOL,
  GLOB_TOOL,
  TODO_WRITE_TOOL,
  LOAD_SKILL_TOOL,
  COMPACT_TOOL,
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<string> {
  switch (name) {
    case "bash": {
      const command = args.command;
      if (typeof command !== "string" || command.trim().length === 0) {
        return "Error: bash requires a non-empty command string";
      }
      return runBash(command, cwd);
    }
    case "read_file": {
      const filePath = args.path;
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        return "Error: read_file requires path";
      }
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      return runRead(filePath, cwd, limit);
    }
    case "write_file": {
      const filePath = args.path;
      const content = args.content;
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        return "Error: write_file requires path";
      }
      if (typeof content !== "string") {
        return "Error: write_file requires content string";
      }
      return runWrite(filePath, content, cwd);
    }
    case "edit_file": {
      const filePath = args.path;
      const oldText = args.old_text;
      const newText = args.new_text;
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        return "Error: edit_file requires path";
      }
      if (typeof oldText !== "string") {
        return "Error: edit_file requires old_text string";
      }
      if (typeof newText !== "string") {
        return "Error: edit_file requires new_text string";
      }
      return runEdit(filePath, oldText, newText, cwd);
    }
    case "glob": {
      const pattern = args.pattern;
      if (typeof pattern !== "string" || pattern.trim().length === 0) {
        return "Error: glob requires pattern";
      }
      return runGlob(pattern, cwd);
    }
    case "todo_write": {
      return runTodoWrite(args.todos);
    }
    case "load_skill": {
      return runLoadSkill(args.name);
    }
    default:
      return `Error: Unknown tool "${name}"`;
  }
}
