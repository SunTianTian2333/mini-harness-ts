import { consolidateMemories } from "../memory/consolidate.js";
import { extractMemories } from "../memory/extract.js";
import { isSubagentContext } from "../subagent/context.js";
import type { ChatMessage } from "../runtime/types.js";

export function createMemoryExtractHook(cwd: string) {
  return async function memoryExtractHook(messages: ChatMessage[]): Promise<null> {
    if (isSubagentContext()) {
      return null;
    }
    const stored = await extractMemories(cwd, messages);
    if (stored > 0) {
      await consolidateMemories(cwd);
    }
    return null;
  };
}
