import { glob } from "node:fs/promises";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { ChatTool } from "../runtime/types.js";

export const READ_FILE_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "read_file",
    description: "Read file contents from the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within workspace" },
        limit: { type: "integer", description: "Optional max lines to return" },
      },
      required: ["path"],
    },
  },
};

export const WRITE_FILE_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "write_file",
    description: "Write content to a file in the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within workspace" },
        content: { type: "string", description: "File content to write" },
      },
      required: ["path", "content"],
    },
  },
};

export const EDIT_FILE_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "edit_file",
    description: "Replace exact text in a file once (first occurrence only).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within workspace" },
        old_text: { type: "string", description: "Exact text to find" },
        new_text: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
};

export const GLOB_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "glob",
    description: "Find files matching a glob pattern; ** matches recursively.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern relative to workspace" },
      },
      required: ["pattern"],
    },
  },
};

export function safePath(relativePath: string, workdir: string): string {
  const root = path.resolve(workdir);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

export async function runRead(filePath: string, workdir: string, limit?: number): Promise<string> {
  try {
    const abs = safePath(filePath, workdir);
    const text = await readFile(abs, "utf8");
    let lines = text.split("\n");
    if (limit !== undefined && limit < lines.length) {
      lines = [...lines.slice(0, limit), `... (${lines.length - limit} more lines)`];
    }
    return lines.join("\n");
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function runWrite(filePath: string, content: string, workdir: string): Promise<string> {
  try {
    const abs = safePath(filePath, workdir);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
    return `Wrote ${content.length} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function runEdit(
  filePath: string,
  oldText: string,
  newText: string,
  workdir: string,
): Promise<string> {
  try {
    const abs = safePath(filePath, workdir);
    const text = await readFile(abs, "utf8");
    if (!text.includes(oldText)) {
      return `Error: text not found in ${filePath}`;
    }
    await writeFile(abs, text.replace(oldText, newText), "utf8");
    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function runGlob(pattern: string, workdir: string): Promise<string> {
  try {
    const root = path.resolve(workdir);
    const iter = glob(pattern, { cwd: root });
    const rawMatches: string[] = [];
    for await (const match of iter) {
      rawMatches.push(match);
    }

    const safe = rawMatches
      .map((match) => match.replace(/\\/g, "/"))
      .filter((match) => {
        const resolved = path.resolve(root, match);
        return resolved === root || resolved.startsWith(root + path.sep);
      })
      .sort();

    const shown = safe.slice(0, 200);
    if (safe.length > 200) {
      shown.push("... (more matches omitted; narrow the pattern)");
    }
    return shown.length > 0 ? shown.join("\n") : "(no matches)";
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
