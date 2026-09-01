import { resolve } from "node:path";

export function warnResumeCwdMismatch(recordedCwd: string, currentCwd: string): boolean {
  const recorded = resolve(recordedCwd);
  const current = resolve(currentCwd);
  if (recorded === current) {
    return false;
  }

  process.stdout.write("\n\x1b[33m[warn] Resuming session from a different working directory\x1b[0m\n");
  process.stdout.write(`   recorded: ${recordedCwd}\n`);
  process.stdout.write(`   current:  ${currentCwd}\n\n`);
  return true;
}
