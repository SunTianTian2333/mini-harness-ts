import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { config as loadEnv } from "dotenv";

import { shutdownBackgroundTasks } from "./background/manager.js";
import { EventQueue } from "./events/queue.js";
import { HarnessSession } from "./events/session.js";
import {
  autoConnectConfiguredMcpServers,
  listConnectedMcpServers,
  shutdownMcpConnections,
} from "./mcp/connect.js";
import { setMcpWorkspaceCwd } from "./mcp/registry.js";
import { setupDefaultHooks } from "./hooks/setup.js";
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
import {
  clearPromptFn,
  setPromptFn,
} from "./runtime/prompt-io.js";

const PROMPT = "\x1b[36mp11 >> \x1b[0m";

function parseCliArgs(argv: string[]): {
  resumeId?: string;
  listSessions?: boolean;
  strictMcp?: boolean;
} {
  let resumeId: string | undefined;
  let listSessions = false;
  let strictMcp = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resume" && argv[index + 1]) {
      resumeId = argv[index + 1];
      index += 1;
    } else if (arg === "--list-sessions") {
      listSessions = true;
    } else if (arg === "--strict-mcp") {
      strictMcp = true;
    }
  }

  return { resumeId, listSessions, strictMcp };
}

async function runEventHarness(
  history: ChatMessage[],
  cwd: string,
  rl: readline.Interface,
): Promise<void> {
  const queue = new EventQueue();
  const harness = new HarnessSession(cwd, history, queue);
  const unbindBackground = harness.bindBackgroundEvents();
  let running = true;

  const consumer = (async () => {
    while (running || queue.hasPending()) {
      let event;
      try {
        event = await queue.waitNext();
      } catch {
        break;
      }
      const answer = await harness.runTurn(event);
      if (answer.trim().length > 0) {
        console.log(`\n${answer}\n`);
      }
      if (running) {
        rl.prompt();
      }
    }
  })();

  rl.setPrompt(PROMPT);
  rl.prompt();

  await new Promise<void>((resolve) => {
    rl.on("line", (line) => {
      const query = line.trim();
      if (query.length === 0 || query.toLowerCase() === "q" || query.toLowerCase() === "exit") {
        running = false;
        queue.close();
        rl.close();
        return;
      }
      queue.push({ type: "user", query });
    });

    rl.on("close", () => {
      running = false;
      queue.close();
      resolve();
    });
  });

  await consumer;
  unbindBackground();
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  migrateLegacyWorkspaceLayout(cwd);
  ensureMiniHarnessRoot(cwd);
  loadEnv({ path: getEnvPath(cwd) });

  const { resumeId, listSessions, strictMcp } = parseCliArgs(process.argv);
  const dbPath = getSessionDbPath(cwd);
  let db: SessionDatabase | undefined;

  try {
    db = new SessionDatabase(dbPath);
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
      return;
    }

    initSkillLoader(cwd);
    setMcpWorkspaceCwd(cwd);
    await autoConnectConfiguredMcpServers(cwd, { strict: strictMcp });

    let sessionStore: SessionStore;
    const history: ChatMessage[] = [];

    if (resumeId) {
      const meta = db.getSession(resumeId);
      if (!meta) {
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
    };

    setupDefaultHooks(cwd, sessionStore);

    process.on("SIGINT", () => {
      shutdownBackgroundTasks();
      endSession("sigint");
      void shutdownMcpConnections()
        .finally(() => {
          db?.close();
          process.exit(0);
        });
    });

    console.log("mini-harness-ts · Phase 11: multi-event turn");
    console.log(`Workspace: ${cwd}`);
    console.log(`Workspace store: ${getMiniHarnessRoot(cwd)}`);
    console.log(`Model: ${model}`);
    console.log(`Session: ${sessionStore.sessionId}`);
    console.log(`DB: ${dbPath}`);
    if (resumeId) {
      console.log(`Resumed with ${history.length} message(s) in history`);
    }
    const connectedMcp = listConnectedMcpServers();
    if (connectedMcp.length > 0) {
      console.log(`Connected MCP servers: ${connectedMcp.join(", ")}`);
    }
    console.log("Enter a task, or q to quit. Background tasks can auto-trigger turns.\n");

    const rl = readline.createInterface({ input, output });
    setPromptFn(
      (label) =>
        new Promise((resolve) => {
          rl.question(label, resolve);
        }),
    );

    try {
      await runEventHarness(history, cwd, rl);
    } finally {
      rl.close();
      clearPromptFn();
      shutdownBackgroundTasks();
      endSession("quit");
    }
  } finally {
    shutdownBackgroundTasks();
    await shutdownMcpConnections();
    db?.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
