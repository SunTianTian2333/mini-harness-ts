import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { getSkillsDir } from "../runtime/paths.js";

export interface SkillRecord {
  name: string;
  description: string;
  content: string;
}

export class SkillLoader {
  private skills = new Map<string, SkillRecord>();

  constructor(private readonly skillsDir: string) {
    this.scan();
  }

  static parseFrontmatter(text: string): { metadata: Record<string, unknown>; body: string } {
    const lines = text.split(/(?<=\n)/);
    if (lines.length === 0 || lines[0]!.replace(/\r?\n$/, "") !== "---") {
      return { metadata: {}, body: text };
    }

    let closingIndex = -1;
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index]!.replace(/\r?\n$/, "") === "---") {
        closingIndex = index;
        break;
      }
    }

    if (closingIndex === -1) {
      return { metadata: {}, body: text };
    }

    const frontmatter = lines.slice(1, closingIndex).join("");
    const body = lines.slice(closingIndex + 1).join("").trim();

    let metadata: unknown;
    try {
      metadata = parseYaml(frontmatter) ?? {};
    } catch {
      metadata = {};
    }

    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
      metadata = {};
    }

    return { metadata: metadata as Record<string, unknown>, body };
  }

  scan(): void {
    this.skills.clear();

    let skillsRoot: string;
    try {
      skillsRoot = realpathSync(resolve(this.skillsDir));
    } catch {
      return;
    }

    let entries: string[];
    try {
      entries = readdirSync(skillsRoot);
    } catch {
      return;
    }

    const manifests = entries
      .map((entry) => join(skillsRoot, entry, "SKILL.md"))
      .sort();

    for (const manifestPath of manifests) {
      let stat;
      try {
        stat = statSync(manifestPath);
      } catch {
        continue;
      }

      if (!stat.isFile()) {
        continue;
      }

      let resolvedManifest: string;
      try {
        resolvedManifest = realpathSync(manifestPath);
      } catch {
        continue;
      }

      if (!this.isInsideRoot(resolvedManifest, skillsRoot)) {
        continue;
      }

      const content = readFileSync(manifestPath, "utf-8");
      const { metadata, body } = SkillLoader.parseFrontmatter(content);

      const rawName = metadata.name;
      let name = typeof rawName === "string" ? rawName.trim() : "";
      if (!name) {
        name = manifestPath.split(/[/\\]/).slice(-2, -1)[0] ?? "unknown";
      }

      const rawDescription = metadata.description;
      let description = typeof rawDescription === "string" ? rawDescription.trim() : "";
      if (!description) {
        description = body.split("\n", 1)[0] ?? "";
      }
      description = description.replace(/^#\s*/, "").replace(/\s+/g, " ").trim();

      this.skills.set(name, { name, description, content });
    }
  }

  catalog(): string {
    if (this.skills.size === 0) {
      return "(no skills found)";
    }

    return [...this.skills.values()]
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join("\n");
  }

  load(name: string): string {
    const skill = this.skills.get(name);
    if (skill) {
      return skill.content;
    }

    const available = [...this.skills.keys()].join(", ") || "none";
    return `Error: Unknown skill '${name}'. Available: ${available}`;
  }

  getSkillNames(): string[] {
    return [...this.skills.keys()];
  }

  private isInsideRoot(targetPath: string, rootPath: string): boolean {
    const rel = relative(rootPath, targetPath);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  }
}

let loader: SkillLoader | null = null;

export function initSkillLoader(cwd: string): SkillLoader {
  loader = new SkillLoader(getSkillsDir(cwd));
  return loader;
}

export function getSkillLoader(): SkillLoader {
  if (!loader) {
    throw new Error("SkillLoader not initialized. Call initSkillLoader() first.");
  }
  return loader;
}
