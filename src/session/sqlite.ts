import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import Database from "better-sqlite3";

import type { SessionEventRecord, SessionEventType, SessionSummary } from "./types.js";

export function getSessionDbPath(cwd: string): string {
  return join(cwd, ".harness", "sessions.db");
}

export class SessionDatabase {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        cwd         TEXT NOT NULL,
        model       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        seq         INTEGER NOT NULL,
        event_type  TEXT NOT NULL,
        payload     TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        UNIQUE(session_id, seq),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, seq);
    `);
  }

  createSession(id: string, cwd: string, model: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO sessions (id, cwd, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, cwd, model, now, now);
  }

  sessionExists(id: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM sessions WHERE id = ?`).get(id);
    return row != null;
  }

  getSession(id: string): SessionSummary | null {
    const row = this.db
      .prepare(
        `SELECT s.id, s.cwd, s.model, s.created_at, s.updated_at,
                COUNT(e.id) AS event_count
         FROM sessions s
         LEFT JOIN events e ON e.session_id = s.id
         WHERE s.id = ?
         GROUP BY s.id`,
      )
      .get(id) as
      | {
          id: string;
          cwd: string;
          model: string | null;
          created_at: string;
          updated_at: string;
          event_count: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      cwd: row.cwd,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventCount: row.event_count,
    };
  }

  touchSession(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(now, id);
  }

  insertEvent(
    sessionId: string,
    seq: number,
    eventType: SessionEventType,
    payload: Record<string, unknown>,
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO events (session_id, seq, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(sessionId, seq, eventType, JSON.stringify(payload), now);
    this.touchSession(sessionId);
  }

  loadEvents(sessionId: string): SessionEventRecord[] {
    const rows = this.db
      .prepare(
        `SELECT session_id, seq, event_type, payload, created_at
         FROM events WHERE session_id = ? ORDER BY seq ASC`,
      )
      .all(sessionId) as Array<{
        session_id: string;
        seq: number;
        event_type: SessionEventType;
        payload: string;
        created_at: string;
      }>;

    return rows.map((row) => ({
      sessionId: row.session_id,
      seq: row.seq,
      eventType: row.event_type,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  maxSeq(sessionId: string): number {
    const row = this.db
      .prepare(`SELECT MAX(seq) AS max_seq FROM events WHERE session_id = ?`)
      .get(sessionId) as { max_seq: number | null } | undefined;
    return row?.max_seq ?? 0;
  }

  listSessions(limit: number): SessionSummary[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.cwd, s.model, s.created_at, s.updated_at,
                COUNT(e.id) AS event_count
         FROM sessions s
         LEFT JOIN events e ON e.session_id = s.id
         GROUP BY s.id
         ORDER BY s.updated_at DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
        id: string;
        cwd: string;
        model: string | null;
        created_at: string;
        updated_at: string;
        event_count: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      cwd: row.cwd,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventCount: row.event_count,
    }));
  }
}
