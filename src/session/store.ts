import type { SessionDatabase } from "./sqlite.js";
import type { SessionEventType } from "./types.js";

export class SessionStore {
  private seq: number;

  constructor(
    public readonly sessionId: string,
    private readonly db: SessionDatabase,
    public readonly cwd: string,
    public readonly model: string,
    initialSeq = 0,
  ) {
    this.seq = initialSeq;
  }

  append(eventType: SessionEventType, payload: Record<string, unknown>): void {
    this.seq += 1;
    this.db.insertEvent(this.sessionId, this.seq, eventType, payload);
  }

  get currentSeq(): number {
    return this.seq;
  }
}

export function createNewSessionStore(
  db: SessionDatabase,
  cwd: string,
  model: string,
  sessionId: string,
): SessionStore {
  db.createSession(sessionId, cwd, model);
  const store = new SessionStore(sessionId, db, cwd, model, 0);
  store.append("session/start", { session_id: sessionId, cwd, model, resumed: false });
  return store;
}

export function resumeSessionStore(
  db: SessionDatabase,
  sessionId: string,
  cwd: string,
  model: string,
): SessionStore {
  if (!db.sessionExists(sessionId)) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const maxSeq = db.maxSeq(sessionId);
  const store = new SessionStore(sessionId, db, cwd, model, maxSeq);
  store.append("session/resume", { session_id: sessionId, event_count: maxSeq });
  return store;
}
