import { formatBackgroundNotifications, BACKGROUND_AUTO_REQUEST } from "../background/format.js";
import { getBackgroundManager } from "../background/manager.js";
import { triggerSideEffectHooks } from "../hooks/registry.js";
import { runLoop } from "../agent/loop.js";
import { setTurnSource } from "../runtime/turn-source.js";
import type { ChatMessage } from "../runtime/types.js";
import type { EventQueue } from "./queue.js";
import type { HarnessEvent } from "./types.js";

export class HarnessSession {
  private turnChain = Promise.resolve();
  private busy = false;

  constructor(
    private readonly cwd: string,
    private readonly history: ChatMessage[],
    private readonly queue: EventQueue,
  ) {}

  isBusy(): boolean {
    return this.busy;
  }

  bindBackgroundEvents(): () => void {
    return getBackgroundManager().onReady(() => {
      if (this.busy) {
        return;
      }
      this.queue.push({ type: "background" });
    });
  }

  runTurn(event: HarnessEvent): Promise<string> {
    const run = this.turnChain.then(() => this.executeTurn(event));
    this.turnChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async executeTurn(event: HarnessEvent): Promise<string> {
    this.busy = true;
    try {
      if (event.type === "user") {
        setTurnSource("user");
        await triggerSideEffectHooks("UserPromptSubmit", event.query);
        this.history.push({ role: "user", content: event.query });
        return runLoop(this.history, this.cwd, event.query);
      }

      setTurnSource("auto");
      const notifications = getBackgroundManager().collect();
      if (notifications.length === 0) {
        return "";
      }
      process.stdout.write("\n\x1b[35m[auto turn]\x1b[0m background task(s) completed\n");
      this.history.push({
        role: "user",
        content: formatBackgroundNotifications(notifications),
      });
      return runLoop(this.history, this.cwd, BACKGROUND_AUTO_REQUEST);
    } finally {
      this.busy = false;
      setTurnSource("user");
    }
  }
}
