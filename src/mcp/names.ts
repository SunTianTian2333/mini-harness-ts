const DISALLOWED_CHARS = /[^a-zA-Z0-9_-]/g;

export function normalizeMcpName(name: string): string {
  const normalized = name.replace(DISALLOWED_CHARS, "_");
  if (!normalized) {
    throw new Error("MCP names cannot normalize to an empty string");
  }
  return normalized;
}

export function buildMcpToolName(serverName: string, toolName: string): string {
  const prefixed = `mcp__${serverName}__${toolName}`;
  if (prefixed.length > 64) {
    throw new Error(`MCP tool name is longer than 64 characters: ${prefixed}`);
  }
  return prefixed;
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith("mcp__");
}
