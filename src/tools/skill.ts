import type { ChatTool } from "../runtime/types.js";
import { getSkillLoader } from "../skill/loader.js";

export const LOAD_SKILL_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "load_skill",
    description: "Load the full SKILL.md content by skill name.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill name from the catalog",
        },
      },
      required: ["name"],
    },
  },
};

export function runLoadSkill(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0) {
    return "Error: load_skill requires a non-empty name string";
  }
  return getSkillLoader().load(name.trim());
}
