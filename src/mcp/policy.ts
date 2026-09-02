import type { McpToolPolicy } from "./types.js";

/** Host-owned policy; never trust MCP server descriptions for authorization. */
export const MCP_HOST_POLICY: Record<string, McpToolPolicy> = {
  "docs:search": "allow",
  "docs:get_version": "allow",
  "deploy:status": "allow",
  "deploy:trigger": "confirm",
};

let activePolicies = new Map<string, McpToolPolicy>();

export function policyKey(serverName: string, toolName: string): string {
  return `${serverName}:${toolName}`;
}

export function hostPolicyFor(serverName: string, toolName: string): McpToolPolicy {
  return MCP_HOST_POLICY[policyKey(serverName, toolName)] ?? "confirm";
}

export function resolveToolPolicy(
  serverName: string,
  toolName: string,
  configured?: ReadonlyMap<string, McpToolPolicy>,
): McpToolPolicy {
  const fromConfig = configured?.get(toolName);
  if (fromConfig) {
    return fromConfig;
  }
  return hostPolicyFor(serverName, toolName);
}

export function setActiveMcpToolPolicies(policies: Map<string, McpToolPolicy>): void {
  activePolicies = new Map(policies);
}

export function getMcpToolPolicy(prefixedToolName: string): McpToolPolicy {
  return activePolicies.get(prefixedToolName) ?? "confirm";
}

export function resetActiveMcpToolPolicies(): void {
  activePolicies = new Map();
}
