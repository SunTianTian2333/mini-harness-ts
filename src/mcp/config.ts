import { readFileSync } from "node:fs";

import { getMcpServersConfigPath } from "../runtime/paths.js";
import type { McpToolPolicy } from "./types.js";

export type MockMcpServerConfig = {
  transport: "mock";
  policy?: Record<string, McpToolPolicy>;
};

export type StdioMcpServerConfig = {
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  policy?: Record<string, McpToolPolicy>;
};

export type McpServerConfig = MockMcpServerConfig | StdioMcpServerConfig;

export type McpServersFile = {
  servers?: Record<string, McpServerConfig>;
  autoConnect?: string[];
};

const EMPTY_CONFIG: McpServersFile = { servers: {}, autoConnect: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePolicyMap(value: unknown): Record<string, McpToolPolicy> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const policies: Record<string, McpToolPolicy> = {};
  for (const [toolName, policy] of Object.entries(value)) {
    if (policy === "allow" || policy === "confirm") {
      policies[toolName] = policy;
    }
  }
  return Object.keys(policies).length > 0 ? policies : undefined;
}

function parseServerConfig(name: string, value: unknown): McpServerConfig | null {
  if (!isRecord(value) || typeof value.transport !== "string") {
    return null;
  }

  const policy = parsePolicyMap(value.policy);

  if (value.transport === "mock") {
    return { transport: "mock", ...(policy ? { policy } : {}) };
  }

  if (value.transport === "stdio") {
    if (typeof value.command !== "string" || value.command.trim().length === 0) {
      process.stderr.write(
        `\x1b[33m[mcp] skipping server '${name}': stdio transport requires a non-empty command\x1b[0m\n`,
      );
      return null;
    }
    return {
      transport: "stdio",
      command: value.command,
      ...(Array.isArray(value.args) ? { args: value.args.filter((arg) => typeof arg === "string") } : {}),
      ...(typeof value.cwd === "string" ? { cwd: value.cwd } : {}),
      ...(isRecord(value.env)
        ? {
            env: Object.fromEntries(
              Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
            ),
          }
        : {}),
      ...(policy ? { policy } : {}),
    };
  }

  return null;
}

export function parseMcpServersFile(raw: unknown): McpServersFile {
  if (!isRecord(raw)) {
    return { ...EMPTY_CONFIG };
  }

  const servers: Record<string, McpServerConfig> = {};
  if (isRecord(raw.servers)) {
    for (const [name, value] of Object.entries(raw.servers)) {
      const parsed = parseServerConfig(name, value);
      if (parsed) {
        servers[name] = parsed;
      }
    }
  }

  const autoConnect = Array.isArray(raw.autoConnect)
    ? raw.autoConnect.filter((name): name is string => typeof name === "string")
    : [];

  return { servers, autoConnect };
}

export function loadMcpServersConfig(cwd: string): McpServersFile {
  const path = getMcpServersConfigPath(cwd);
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return parseMcpServersFile(raw);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return { ...EMPTY_CONFIG };
    }
    if (error instanceof SyntaxError) {
      return { ...EMPTY_CONFIG };
    }
    throw error;
  }
}

export function getConfiguredMcpServer(
  cwd: string,
  name: string,
): McpServerConfig | undefined {
  return loadMcpServersConfig(cwd).servers?.[name];
}
