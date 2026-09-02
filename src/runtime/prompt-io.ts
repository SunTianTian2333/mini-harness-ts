export type PromptFn = (label: string) => Promise<string>;

let promptFn: PromptFn | null = null;
let busyReason: string | null = null;

export function setPromptFn(fn: PromptFn): void {
  promptFn = fn;
}

export function clearPromptFn(): void {
  promptFn = null;
  busyReason = null;
}

export function getPromptBusyReason(): string | null {
  return busyReason;
}

export async function promptUser(label: string, reason?: string): Promise<string> {
  if (!promptFn) {
    throw new Error("promptUser called before setPromptFn");
  }
  busyReason = reason ?? null;
  try {
    return await promptFn(label);
  } finally {
    busyReason = null;
  }
}
