import type {
  BlockingHookResult,
  HookCallback,
  HookEvent,
  PostToolBatchCallback,
  PostToolBatchContext,
  SideEffectHookEvent,
} from "./types.js";

const HOOKS: Record<HookEvent, HookCallback[]> = {
  UserPromptSubmit: [],
  PreToolUse: [],
  PostToolUse: [],
  PostToolBatch: [],
  Stop: [],
  TurnStart: [],
  LlmResponse: [],
  ToolDenied: [],
};

const POST_TOOL_BATCH_HOOKS: PostToolBatchCallback[] = [];

export function registerHook(event: HookEvent, callback: HookCallback): void {
  HOOKS[event].push(callback);
}

export function registerPostToolBatchHook(callback: PostToolBatchCallback): void {
  POST_TOOL_BATCH_HOOKS.push(callback);
}

export function clearHooks(): void {
  for (const event of Object.keys(HOOKS) as HookEvent[]) {
    HOOKS[event] = [];
  }
  POST_TOOL_BATCH_HOOKS.length = 0;
}

/** PreToolUse / Stop：顺序 await，首个非空返回值短路 */
export async function triggerHooks(event: "PreToolUse" | "Stop", ...args: unknown[]): Promise<BlockingHookResult> {
  for (const callback of HOOKS[event]) {
    const result = await callback(...args);
    if (result != null && result !== "") {
      return result;
    }
  }
  return null;
}

/** 副作用 hook：返回值不参与控制流 */
export async function triggerSideEffectHooks(
  event: SideEffectHookEvent,
  ...args: unknown[]
): Promise<void> {
  for (const callback of HOOKS[event]) {
    await callback(...args);
  }
}

export async function triggerPostToolBatch(ctx: PostToolBatchContext): Promise<void> {
  for (const callback of POST_TOOL_BATCH_HOOKS) {
    await callback(ctx);
  }
}
