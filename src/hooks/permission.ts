import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { safePath } from "../tools/file.js";
import { getMcpToolPolicy } from "../mcp/policy.js";
import { isMcpToolName } from "../mcp/names.js";
import type { ToolCallBlock } from "./types.js";

const DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"];

const DESTRUCTIVE_COMMAND = /(?:^|[;&|()\n])\s*(?:rm|del)(?=\s|$|[;&|()])/i;

function pathEscapesWorkspace(relativePath: string, workdir: string): boolean {
  try {
    safePath(relativePath, workdir);
    return false;
  } catch {
    return true;
  }
}

function containsDestructiveCommand(command: string): boolean {
  return (
    DESTRUCTIVE_COMMAND.test(command) ||
    command.includes("rm ") ||
    command.includes("> /etc/") ||
    command.includes("chmod 777")
  );
}

function checkDenyList(command: string): string | null {
  for (const pattern of DENY_LIST) {
    if (command.includes(pattern)) {
      return `Blocked: '${pattern}' is on the deny list`;
    }
  }
  return null;
}

function checkRules(toolName: string, args: Record<string, unknown>, workdir: string): string | null {
  if (toolName === "read_file" || toolName === "write_file" || toolName === "edit_file") {
    const filePath = typeof args.path === "string" ? args.path : "";
    if (pathEscapesWorkspace(filePath, workdir)) {
      return "Path outside workspace";
    }
  }

  if (toolName === "bash") {
    const command = typeof args.command === "string" ? args.command : "";
    if (containsDestructiveCommand(command)) {
      return "Potentially destructive command";
    }
  }

  return null;
}

async function askUser(toolName: string, args: Record<string, unknown>, reason: string): Promise<boolean> {
  process.stdout.write(`\n\x1b[33m[permission] ${reason}\x1b[0m\n`);
  process.stdout.write(`   Tool: ${toolName}(${JSON.stringify(args)})\n`);
  const rl = readline.createInterface({ input, output });
  try {
    const choice = (await rl.question("   Allow? [y/N] ")).trim().toLowerCase();
    return choice === "y" || choice === "yes";
  } finally {
    rl.close();
  }
}

export function createPermissionHook(workdir: string) {
  return async function permissionHook(block: ToolCallBlock): Promise<string | null> {
    if (block.name === "bash") {
      const command = typeof block.input.command === "string" ? block.input.command : "";
      const denied = checkDenyList(command);
      if (denied) {
        process.stdout.write(`\n\x1b[31m[blocked] ${denied}\x1b[0m\n`);
        return "Permission denied.";
      }
    }

    const ruleReason = checkRules(block.name, block.input, workdir);
    if (ruleReason) {
      const allowed = await askUser(block.name, block.input, ruleReason);
      if (!allowed) {
        return "Permission denied.";
      }
    }

    if (isMcpToolName(block.name)) {
      const policy = getMcpToolPolicy(block.name);
      if (policy !== "allow") {
        const allowed = await askUser(block.name, block.input, "External MCP tool");
        if (!allowed) {
          return "Permission denied.";
        }
      }
    }

    return null;
  };
}

export { checkDenyList, checkRules, containsDestructiveCommand, pathEscapesWorkspace };
