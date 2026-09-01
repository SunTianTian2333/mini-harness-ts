import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SkillLoader } from "./loader.js";

function writeSkill(
  root: string,
  dirName: string,
  manifest: string,
): void {
  const skillDir = join(root, "skills", dirName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), manifest, "utf-8");
}

describe("SkillLoader", () => {
  it("catalog stays small and load returns the full file", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-test-"));
    const manifest = `---
name: code-review
description: |
  Review code for bugs,
  regressions, and missing tests.
---

# Code Review

UNIQUE_FULL_INSTRUCTION
`;
    writeSkill(root, "code-review", manifest);

    const loader = new SkillLoader(join(root, "skills"));
    assert.equal(
      loader.catalog(),
      "- code-review: Review code for bugs, regressions, and missing tests.",
    );
    assert.equal(loader.load("code-review"), manifest);
    assert.doesNotMatch(loader.catalog(), /UNIQUE_FULL_INSTRUCTION/);
  });

  it("reads utf-8 manifests", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-test-"));
    const manifest = `---
name: chinese-skill
description: 处理中文内容
---

# 中文技能
`;
    writeSkill(root, "chinese-skill", manifest);

    const loader = new SkillLoader(join(root, "skills"));
    assert.equal(loader.load("chinese-skill"), manifest);
    assert.match(loader.catalog(), /处理中文内容/);
  });

  it("requires standalone frontmatter delimiters", () => {
    const invalidOpening = "---not frontmatter\n---\n# Body";
    const blockScalar = `---
name: demo
description: |
  before
  ---
  after
---
# Body
`;

    const parsedInvalid = SkillLoader.parseFrontmatter(invalidOpening);
    assert.deepEqual(parsedInvalid.metadata, {});
    assert.equal(parsedInvalid.body, invalidOpening);

    for (const text of [blockScalar, blockScalar.replace(/\n/g, "\r\n")]) {
      const parsed = SkillLoader.parseFrontmatter(text);
      assert.equal(parsed.metadata.description, "before\n---\nafter\n");
      assert.equal(parsed.body, "# Body");
    }
  });

  it("falls back for invalid or empty metadata and skips symlink escapes", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-test-"));

    writeSkill(root, "fallback-skill", "---\nname:\ndescription:\n---\n# Body description\n");
    writeSkill(root, "empty-skill", "---\nname: empty-skill\n---\n");
    writeSkill(root, "typed-fallback", "---\nname: [bad]\ndescription: [bad]\n---\n# Typed fallback\n");

    const outside = join(root, "outside-skill.md");
    writeFileSync(outside, "# External skill\n\nDO_NOT_LOAD", "utf-8");

    const linkedDir = join(root, "skills", "linked-skill");
    mkdirSync(linkedDir, { recursive: true });
    symlinkSync(outside, join(linkedDir, "SKILL.md"));

    const loader = new SkillLoader(join(root, "skills"));
    assert.match(loader.catalog(), /fallback-skill: Body description/);
    assert.match(loader.catalog(), /empty-skill:/);
    assert.match(loader.catalog(), /typed-fallback: Typed fallback/);
    assert.equal(loader.getSkillNames().includes("linked-skill"), false);

    const parsed = SkillLoader.parseFrontmatter("---\n- not\n- a mapping\n---\nBody");
    assert.deepEqual(parsed.metadata, {});
    assert.equal(parsed.body, "Body");
  });

  it("returns helpful error for unknown skill", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-test-"));
    writeSkill(root, "demo", "---\nname: demo\ndescription: Demo\n---\n# Demo\n");

    const loader = new SkillLoader(join(root, "skills"));
    const result = loader.load("missing");
    assert.match(result, /Error: Unknown skill 'missing'/);
    assert.match(result, /Available: demo/);
  });

  it("reports no skills when directory is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-test-"));
    const loader = new SkillLoader(join(root, "skills"));
    assert.equal(loader.catalog(), "(no skills found)");
  });
});
