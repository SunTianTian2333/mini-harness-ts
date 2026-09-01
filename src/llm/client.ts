import OpenAI from "openai";
import "dotenv/config";

import type { ChatMessage, ChatTool } from "../runtime/types.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY. Copy .env.example to .env and fill in your key.");
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com/v1",
    });
  }
  return client;
}

function getModelId(): string {
  return process.env.OPENAI_MODEL ?? "deepseek-chat";
}

export async function createAssistantTurn(
  system: string,
  messages: ChatMessage[],
  tools: ChatTool[],
): Promise<{ message: OpenAI.Chat.Completions.ChatCompletionMessage; finishReason: string | null }> {
  const response = await getClient().chat.completions.create({
    model: getModelId(),
    messages: [{ role: "system", content: system }, ...messages],
    tools,
  });

  const message = response.choices[0]?.message;
  if (!message) {
    throw new Error("LLM returned empty message");
  }
  return { message, finishReason: response.choices[0]?.finish_reason ?? null };
}

export { getModelId };
