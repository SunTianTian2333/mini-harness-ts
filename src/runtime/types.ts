import type OpenAI from "openai";

/** OpenAI Chat Completions 消息格式（DeepSeek 等兼容网关通用） */
export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** OpenAI tool 定义 */
export type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

export const MAX_TURNS = 10;
