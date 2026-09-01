import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

import {
  ensureMiniHarnessRoot,
  getEnvPath,
  getMiniHarnessRoot,
  getSessionDbPath,
  getSkillsDir,
} from "./paths.js";

/** One-time local migration from pre-P5c layout (.harness/, root skills/, root .env). */
export function migrateLegacyWorkspaceLayout(cwd: string): void {
  ensureMiniHarnessRoot(cwd);

  const legacyHarness = join(cwd, ".harness");
  const legacySkills = join(cwd, "skills");
  const legacyEnv = join(cwd, ".env");
  const targetRoot = getMiniHarnessRoot(cwd);

  if (existsSync(join(legacyHarness, "sessions.db")) && !existsSync(getSessionDbPath(cwd))) {
    renameSync(join(legacyHarness, "sessions.db"), getSessionDbPath(cwd));
  }

  for (const wal of ["sessions.db-wal", "sessions.db-shm"] as const) {
    const from = join(legacyHarness, wal);
    const to = join(targetRoot, wal);
    if (existsSync(from) && !existsSync(to)) {
      renameSync(from, to);
    }
  }

  if (existsSync(legacySkills) && !existsSync(getSkillsDir(cwd))) {
    renameSync(legacySkills, getSkillsDir(cwd));
  }

  if (existsSync(legacyEnv) && !existsSync(getEnvPath(cwd))) {
    renameSync(legacyEnv, getEnvPath(cwd));
  }
}
