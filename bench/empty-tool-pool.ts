import type { AssembledToolPool } from "../../src/mcp/types.js";

export function emptyToolPool(): AssembledToolPool {
  return {
    tools: [],
    execute: async () => "Error: bench QA mode has no tools",
  };
}
