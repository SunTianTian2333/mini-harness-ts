import type { ToolCallBlock } from "./types.js";

const LARGE_OUTPUT_THRESHOLD = 100_000;

export function largeOutputHook(block: ToolCallBlock, output: string): null {
  if (output.length > LARGE_OUTPUT_THRESHOLD) {
    process.stdout.write(
      `\x1b[33m[HOOK] Large output from ${block.name}: ${output.length} chars\x1b[0m\n`,
    );
  }
  return null;
}
