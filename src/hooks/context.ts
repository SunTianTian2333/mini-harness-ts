export function createContextInjectHook(cwd: string) {
  return function contextInjectHook(): null {
    process.stdout.write(`\x1b[90m[HOOK] UserPromptSubmit: working in ${cwd}\x1b[0m\n`);
    return null;
  };
}
