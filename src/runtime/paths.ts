import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const MINI_HARNESS_DIR = ".mini-harness";

export function getMiniHarnessRoot(cwd: string): string {
  return join(cwd, MINI_HARNESS_DIR);
}

export function ensureMiniHarnessRoot(cwd: string): string {
  const root = getMiniHarnessRoot(cwd);
  mkdirSync(root, { recursive: true });
  return root;
}

export function getEnvPath(cwd: string): string {
  return join(getMiniHarnessRoot(cwd), ".env");
}

export function getSessionDbPath(cwd: string): string {
  return join(getMiniHarnessRoot(cwd), "sessions.db");
}

export function getSkillsDir(cwd: string): string {
  return join(getMiniHarnessRoot(cwd), "skills");
}

export function getMemoryDir(cwd: string): string {
  return join(getMiniHarnessRoot(cwd), "memory");
}
