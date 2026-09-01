export type SessionEventType =
  | "session/start"
  | "session/resume"
  | "session/end"
  | "user/message"
  | "turn/start"
  | "llm/response"
  | "tool/start"
  | "tool/denied"
  | "tool/result";

export interface SessionEventRecord {
  sessionId: string;
  seq: number;
  eventType: SessionEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  cwd: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
}

export interface LlmResponsePayload {
  content: string | null;
  tool_calls?: unknown;
  finish_reason?: string | null;
}
