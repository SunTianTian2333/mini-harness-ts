import { runBash } from "./bash.js";
import { runRead, runWrite, runEdit, runGlob } from "./file.js";
import { runTodoWrite } from "./todo.js";
import { runLoadSkill } from "./skill.js";
import { runCompact } from "./compact.js";
import {
  runClaimTask,
  runCompleteTask,
  runCreateTask,
  runGetTask,
  runListTasks,
  runUpdateTask,
} from "./task.js";

export async function executeBuiltinTool(
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
    case "compact": {
      return runCompact();
    }
    case "create_task": {
      return runCreateTask(cwd, args.subject, args.description);
    }
    case "update_task": {
      return runUpdateTask(cwd, args.task_id, args.addBlockedBy);
    }
    case "list_tasks": {
      return runListTasks(cwd);
    }
    case "get_task": {
      return runGetTask(cwd, args.task_id);
    }
    case "claim_task": {
      return runClaimTask(cwd, args.task_id);
    }
    case "complete_task": {
      return runCompleteTask(cwd, args.task_id);
    }
    default:
      return `Error: Unknown tool "${name}"`;
  }
}
