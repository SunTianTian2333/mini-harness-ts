import type { ToolCallBlock } from "./types.js";

export function logHook(block: ToolCallBlock): null {
  const preview = JSON.stringify(Object.values(block.input).slice(0, 2)).slice(0, 60);
  process.stdout.write(`\x1b[90m[HOOK] ${block.name}(${preview})\x1b[0m\n`);
  return null;
}
