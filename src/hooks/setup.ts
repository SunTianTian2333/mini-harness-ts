import { createContextInjectHook } from "./context.js";
import { largeOutputHook } from "./large-output.js";
import { logHook } from "./log.js";
import { createMemoryExtractHook } from "./memory-extract.js";
import { createPermissionHook } from "./permission.js";
import { clearHooks, registerHook, registerPostToolBatchHook } from "./registry.js";
import { reminderHook } from "./reminder.js";
import { createSessionLogHooks } from "./session-log.js";
import { summaryHook } from "./summary.js";
import type { SessionStore } from "../session/store.js";
import type { LlmResponsePayload } from "../session/types.js";
import type { ToolCallBlock } from "./types.js";
import type { ChatMessage } from "../runtime/types.js";

export function setupBenchHooks(): { getTurnCount: () => number } {
  clearHooks();

  let turnCount = 0;
  registerHook("TurnStart", (...args) => {
    turnCount += 1;
    return null;
  });
  registerHook("Stop", () => null);

  return {
    getTurnCount: () => turnCount,
  };
}

export function setupDefaultHooks(cwd: string, sessionStore?: SessionStore): void {
  clearHooks();

  const permissionHook = createPermissionHook(cwd);

  registerHook("UserPromptSubmit", createContextInjectHook(cwd));
  registerHook("PreToolUse", (...args) => permissionHook(args[0] as ToolCallBlock));
  registerHook("PreToolUse", (...args) => logHook(args[0] as ToolCallBlock));
  registerHook("PostToolUse", (...args) => largeOutputHook(args[0] as ToolCallBlock, args[1] as string));
  registerPostToolBatchHook(reminderHook);
  registerHook("Stop", (...args) => summaryHook(args[0] as ChatMessage[]));

  const memoryExtractHook = createMemoryExtractHook(cwd);
  registerHook("Stop", (...args) => memoryExtractHook(args[0] as ChatMessage[]));

  if (sessionStore) {
    const sessionLog = createSessionLogHooks(sessionStore);

    registerHook("UserPromptSubmit", (...args) => sessionLog.userMessage(args[0] as string));
    registerHook("TurnStart", (...args) => sessionLog.turnStart(args[0] as number));
    registerHook("LlmResponse", (...args) => sessionLog.llmResponse(args[0] as LlmResponsePayload));
    registerHook("PreToolUse", (...args) => sessionLog.toolStart(args[0] as ToolCallBlock));
    registerHook("PostToolUse", (...args) =>
      sessionLog.toolResult(args[0] as ToolCallBlock, args[1] as string),
    );
    registerHook("ToolDenied", (...args) =>
      sessionLog.toolDenied(args[0] as ToolCallBlock, args[1] as string),
    );
  }
}
