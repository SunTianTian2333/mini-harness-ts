import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateSessionId } from "./id.js";
import { SessionDatabase } from "./sqlite.js";
import { createNewSessionStore, resumeSessionStore } from "./store.js";
import { projectToMessages } from "./project.js";

describe("SessionDatabase", () => {
  it("persists events and reloads them in order", () => {
    const db = new SessionDatabase(":memory:");
    const sessionId = generateSessionId();
    const store = createNewSessionStore(db, "/tmp/work", "test-model", sessionId);

    store.append("user/message", { content: "ping" });
    store.append("llm/response", { content: "pong", tool_calls: null, finish_reason: "stop" });

    const events = db.loadEvents(sessionId);
    assert.equal(events.length, 3);
    assert.equal(events[0]?.eventType, "session/start");
    assert.equal(events[1]?.payload.content, "ping");
    assert.equal(events[2]?.eventType, "llm/response");

    db.close();
  });

  it("resume continues seq and rebuilds messages", () => {
    const db = new SessionDatabase(":memory:");
    const sessionId = generateSessionId();
    const first = createNewSessionStore(db, "/tmp/work", "test-model", sessionId);
    first.append("user/message", { content: "remember me" });
    first.append("llm/response", { content: "ok", tool_calls: null, finish_reason: "stop" });

    const resumed = resumeSessionStore(db, sessionId, "/tmp/work", "test-model");
    resumed.append("user/message", { content: "follow up" });

    const messages = projectToMessages(db.loadEvents(sessionId));
    assert.equal(messages.length, 3);
    assert.equal(messages[0]?.content, "remember me");
    assert.equal(messages[1]?.content, "ok");
    assert.equal(messages[2]?.content, "follow up");

    const lastEvent = db.loadEvents(sessionId).at(-1);
    assert.equal(lastEvent?.eventType, "user/message");
    assert.equal(lastEvent?.payload.content, "follow up");
    assert.ok((lastEvent?.seq ?? 0) > first.currentSeq);

    db.close();
  });

  it("lists sessions with event counts", () => {
    const db = new SessionDatabase(":memory:");
    createNewSessionStore(db, "/tmp/a", "m1", generateSessionId());
    createNewSessionStore(db, "/tmp/b", "m2", generateSessionId());

    const listed = db.listSessions(10);
    assert.equal(listed.length, 2);
    assert.ok(listed[0]!.eventCount >= 1);

    db.close();
  });

  it("getSession returns session metadata", () => {
    const db = new SessionDatabase(":memory:");
    const sessionId = generateSessionId();
    createNewSessionStore(db, "/tmp/work", "test-model", sessionId);

    const meta = db.getSession(sessionId);
    assert.ok(meta);
    assert.equal(meta.cwd, "/tmp/work");
    assert.equal(meta.model, "test-model");
    assert.equal(db.getSession("missing"), null);

    db.close();
  });
});
