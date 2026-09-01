import type OpenAI from "openai";

import { getSkillLoader } from "../skill/loader.js";
import { getSkillsDir } from "./paths.js";

/** OpenAI Chat Completions 消息格式（DeepSeek 等兼容网关通用） */
export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** OpenAI tool 定义 */
export type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

export const MAX_TURNS = 10;

export function getSystemPrompt(cwd: string): string {
  const catalog = getSkillLoader().catalog();
  return `You are a coding agent at ${cwd}. Use tools to solve tasks. Before multi-step work, use todo_write to plan steps and update status as you go. Destructive operations may require user approval. Act, don't explain.

Skills available:
${catalog}

Skills directory: ${getSkillsDir(cwd)}. Use load_skill to read full instructions; do not bash-search for SKILL.md.`;
}
