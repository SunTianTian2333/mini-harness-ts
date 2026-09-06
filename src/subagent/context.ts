let subagentDepth = 0;

export function isSubagentContext(): boolean {
  return subagentDepth > 0;
}

export async function withSubagentContext<T>(fn: () => Promise<T>): Promise<T> {
  subagentDepth += 1;
  try {
    return await fn();
  } finally {
    subagentDepth -= 1;
  }
}
