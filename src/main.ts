import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadEnv } from "dotenv";

import { runLoop } from "./agent/loop.js";
import { setupDefaultHooks } from "./hooks/setup.js";
import { triggerSideEffectHooks } from "./hooks/registry.js";
import { getModelId } from "./llm/client.js";
import { migrateLegacyWorkspaceLayout } from "./runtime/migrate.js";
import {
  ensureMiniHarnessRoot,
  getEnvPath,
  getMiniHarnessRoot,
  getSessionDbPath,
} from "./runtime/paths.js";
import { generateSessionId } from "./session/id.js";
import { projectToMessages } from "./session/project.js";
import { warnResumeCwdMismatch } from "./session/resume.js";
import { SessionDatabase } from "./session/sqlite.js";
import { createNewSessionStore, resumeSessionStore, type SessionStore } from "./session/store.js";
import { initSkillLoader } from "./skill/loader.js";
import type { ChatMessage } from "./runtime/types.js";

function parseCliArgs(argv: string[]): { resumeId?: string; listSessions?: boolean } {
  let resumeId: string | undefined;
  let listSessions = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resume" && argv[index + 1]) {
      resumeId = argv[index + 1];
      index += 1;
    } else if (arg === "--list-sessions") {
      listSessions = true;
    }
  }

  return { resumeId, listSessions };
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  migrateLegacyWorkspaceLayout(cwd);
  ensureMiniHarnessRoot(cwd);
  loadEnv({ path: getEnvPath(cwd) });

  const { resumeId, listSessions } = parseCliArgs(process.argv);
  const dbPath = getSessionDbPath(cwd);
  const db = new SessionDatabase(dbPath);
  const model = getModelId();

  if (listSessions) {
    const sessions = db.listSessions(10);
    if (sessions.length === 0) {
      console.log("(no sessions)");
    } else {
      for (const session of sessions) {
        console.log(`${session.id}  events=${session.eventCount}  updated=${session.updatedAt}`);
      }
    }
    db.close();
    return;
  }

  initSkillLoader(cwd);

  let sessionStore: SessionStore;
  const history: ChatMessage[] = [];

  if (resumeId) {
    const meta = db.getSession(resumeId);
    if (!meta) {
      db.close();
      throw new Error(`Session not found: ${resumeId}`);
    }
    warnResumeCwdMismatch(meta.cwd, cwd);
    const events = db.loadEvents(resumeId);
    history.push(...projectToMessages(events));
    sessionStore = resumeSessionStore(db, resumeId, cwd, model);
  } else {
    sessionStore = createNewSessionStore(db, cwd, model, generateSessionId());
  }

  let sessionEnded = false;
  const endSession = (reason: string): void => {
    if (sessionEnded) {
      return;
    }
    sessionEnded = true;
    sessionStore.append("session/end", { reason });
    db.close();
  };

  setupDefaultHooks(cwd, sessionStore);

  process.on("SIGINT", () => {
    endSession("sigint");
    process.exit(0);
  });

  console.log("mini-harness-ts · Phase 6: Memory");
  console.log(`Workspace: ${cwd}`);
  console.log(`Workspace store: ${getMiniHarnessRoot(cwd)}`);
  console.log(`Model: ${model}`);
  console.log(`Session: ${sessionStore.sessionId}`);
  console.log(`DB: ${dbPath}`);
  if (resumeId) {
    console.log(`Resumed with ${history.length} message(s) in history`);
  }
  console.log("Enter a task, or q to quit.\n");

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const query = (await rl.question("\x1b[36mp6 >> \x1b[0m")).trim();
      if (query.length === 0 || query.toLowerCase() === "q" || query.toLowerCase() === "exit") {
        break;
      }

      await triggerSideEffectHooks("UserPromptSubmit", query);
      history.push({ role: "user", content: query });
      const answer = await runLoop(history, cwd);
      console.log(`\n${answer}\n`);
    }
  } finally {
    rl.close();
    endSession("quit");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
