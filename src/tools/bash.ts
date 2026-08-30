import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ChatTool } from "../runtime/types.js";

const execFileAsync = promisify(execFile);

const DANGEROUS_PATTERNS = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

export const BASH_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "bash",
    description: "Run a shell command in the workspace.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
      },
      required: ["command"],
    },
  },
};

export const TOOL_SCHEMAS: ChatTool[] = [BASH_TOOL];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => command.includes(pattern));
}

export async function runBash(command: string, cwd: string): Promise<string> {
  if (isDangerous(command)) {
    return "Error: Dangerous command blocked";
  }

  try {
    const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", command], {
      cwd,
      timeout: 120_000,
      maxBuffer: 512 * 1024,
      encoding: "utf8",
    });
    const output = `${stdout}${stderr}`.trim();
    return output.length > 0 ? output.slice(0, 50_000) : "(no output)";
  } catch (error) {
    if (error instanceof Error) {
      const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const detail = `${execError.stdout ?? ""}${execError.stderr ?? ""}`.trim();
      if (execError.code === "ETIMEDOUT") {
        return "Error: Timeout (120s)";
      }
      return detail ? `Error: ${detail.slice(0, 2_000)}` : `Error: ${execError.message}`;
    }
    return "Error: Unknown execution failure";
  }
}

export async function executeTool(name: string, input: Record<string, unknown>, cwd: string): Promise<string> {
  if (name !== "bash") {
    return `Error: Unknown tool "${name}"`;
  }
  const command = input.command;
  if (typeof command !== "string" || command.trim().length === 0) {
    return "Error: bash requires a non-empty command string";
  }
  return runBash(command, cwd);
}
