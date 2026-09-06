import type { ToolCallBlock } from "./types.js";
import { isSubagentContext } from "../subagent/context.js";

export function logHook(block: ToolCallBlock): null {
  const preview = JSON.stringify(Object.values(block.input).slice(0, 2)).slice(0, 60);
  const prefix = isSubagentContext() ? "[sub] " : "";
  process.stdout.write(`\x1b[90m[HOOK] ${prefix}${block.name}(${preview})\x1b[0m\n`);
  return null;
}
