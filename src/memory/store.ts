import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { stringify as stringifyYaml } from "yaml";

import { getMemoryDir } from "../runtime/paths.js";
import { SkillLoader } from "../skill/loader.js";
import type { MemoryRecord, MemoryType } from "./types.js";

export const MEMORY_INDEX_NAME = "MEMORY.md";

export function memorySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "memory";
}

export class MemoryStore {
  constructor(private readonly memoryDir: string) {}

  static forCwd(cwd: string): MemoryStore {
    const dir = getMemoryDir(cwd);
    mkdirSync(dir, { recursive: true });
    return new MemoryStore(dir);
  }

  memoryPath(filename: string, allowIndex = false): string {
    if (filename.includes("/") || filename.includes("\\")) {
      throw new Error(`Invalid memory filename: ${filename}`);
    }
    if (filename === MEMORY_INDEX_NAME && !allowIndex) {
      throw new Error("The memory index is not a memory record");
    }

    const root = resolve(this.memoryDir);
    const path = resolve(root, filename);
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Memory path escapes the store: ${filename}`);
    }
    return path;
  }

  listRecords(): MemoryRecord[] {
    let entries: string[];
    try {
      entries = readdirSync(this.memoryDir);
    } catch {
      return [];
    }

    const records: MemoryRecord[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith(".md") || entry === MEMORY_INDEX_NAME) {
        continue;
      }
      try {
        const path = this.memoryPath(entry);
        const stat = statSync(path);
        if (!stat.isFile()) {
          continue;
        }
        const content = readFileSync(path, "utf-8");
        const { metadata, body } = SkillLoader.parseFrontmatter(content);
        records.push({
          filename: entry,
          name: String(metadata.name ?? entry.replace(/\.md$/, "")),
          description: String(metadata.description ?? ""),
          type: (metadata.type as MemoryType) ?? "project",
          body: body.trim(),
        });
      } catch {
        continue;
      }
    }
    return records;
  }

  readIndex(): string {
    try {
      const path = this.memoryPath(MEMORY_INDEX_NAME, true);
      return readFileSync(path, "utf-8").trim();
    } catch {
      return "";
    }
  }

  readFile(filename: string): string | null {
    try {
      return readFileSync(this.memoryPath(filename), "utf-8");
    } catch {
      return null;
    }
  }

  writeRecord(name: string, type: MemoryType, description: string, body: string): string {
    const filename = `${memorySlug(name)}.md`;
    const metadata = stringifyYaml({ name, description, type }).trim();
    const document = `---\n${metadata}\n---\n\n${body.trim()}\n`;
    writeFileSync(this.memoryPath(filename), document, "utf-8");
    this.rebuildIndex();
    return filename;
  }

  rebuildIndex(): void {
    mkdirSync(this.memoryDir, { recursive: true });
    const lines: string[] = [];
    for (const record of this.listRecords()) {
      const preview =
        record.description.trim() ||
        record.body.split("\n").find((line) => line.trim())?.trim() ||
        record.name;
      lines.push(`- [${record.name}](${record.filename}) - ${preview}`);
    }
    writeFileSync(this.memoryPath(MEMORY_INDEX_NAME, true), lines.length ? `${lines.join("\n")}\n` : "", "utf-8");
  }

  replaceAllRecords(records: Array<{ name: string; type: MemoryType; description: string; body: string }>): void {
    const snapshot = new Map<string, string>();
    for (const record of this.listRecords()) {
      snapshot.set(record.filename, readFileSync(this.memoryPath(record.filename), "utf-8"));
    }

    try {
      for (const record of this.listRecords()) {
        unlinkSync(this.memoryPath(record.filename));
      }
      for (const record of records) {
        this.writeRecord(record.name, record.type, record.description, record.body);
      }
    } catch (error) {
      for (const record of this.listRecords()) {
        try {
          unlinkSync(this.memoryPath(record.filename));
        } catch {
          /* ignore */
        }
      }
      for (const [filename, content] of snapshot) {
        writeFileSync(this.memoryPath(filename), content, "utf-8");
      }
      this.rebuildIndex();
      throw error;
    }
  }
}
