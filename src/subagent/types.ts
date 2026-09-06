export const SUB_MAX_TURNS = 30;

export const SUBAGENT_TOOL_NAMES = new Set([
  "bash",
  "read_file",
  "write_file",
  "edit_file",
  "glob",
]);

export const SUBAGENT_TIMEOUT_MESSAGE =
  "Subagent stopped after 30 turns without a final answer.";
