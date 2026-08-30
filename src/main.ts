import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { runLoop } from "./agent/loop.js";
import type { ChatMessage } from "./runtime/types.js";

const cwd = process.cwd();

async function main(): Promise<void> {
  console.log("mini-harness-ts · Phase 1: Agent Loop");
  console.log(`Workspace: ${cwd}`);
  console.log(`Model: ${process.env.OPENAI_MODEL ?? "deepseek-chat"}`);
  console.log("Enter a task, or q to quit.\n");

  const rl = readline.createInterface({ input, output });
  const history: ChatMessage[] = [];

  try {
    while (true) {
      const query = (await rl.question("\x1b[36mp1 >> \x1b[0m")).trim();
      if (query.length === 0 || query.toLowerCase() === "q" || query.toLowerCase() === "exit") {
        break;
      }

      history.push({ role: "user", content: query });
      const answer = await runLoop(history, cwd);
      console.log(`\n${answer}\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
