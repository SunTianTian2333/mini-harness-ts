---
name: piano-composition
description: >
  钢琴原创作曲：自然语言需求 → 规划曲式与和声 → 写 Composition JSON →
  mcp__music__validate_composition → create_midi → render_audio → 交付 json/mid/wav。
  用户说写钢琴曲、作曲、轻音乐、放松/梦幻/抒情钢琴时使用。
  必须先 load_skill 再执行，禁止未读 skill 即 read music_mcp 源码。
---

# Piano Composition

## 1. 角色边界

| Agent 做 | Agent 不做 |
|----------|------------|
| 理解需求，补全 tempo / 调性 / 拍号 / 时长 / 情绪 | MIDI 编码、音频合成、左手逐音编写 |
| 规划曲式（structure + chords）再写右手旋律 | 读 `music_mcp/` 源码（规则在本 skill） |
| 写 `piano_output/<slug>.json` | 用 `bash rm` 清理文件（覆盖写即可） |
| 调用 3 个 music MCP 工具并 repair | 一次 inline 5000+ 字 JSON 反复传 MCP |

**Music MCP 工具（autoConnect `music`）：**

| 工具 | 用途 |
|------|------|
| `mcp__music__validate_composition` | 校验 JSON |
| `mcp__music__create_midi` | 生成 MIDI |
| `mcp__music__render_audio` | MIDI → WAV |

## 2. 标准 Pipeline（必须按序）

```
load_skill("piano-composition")

Phase 0 · 澄清（缺则补默认，见 §3）
Phase 1 · 规划（只动脑 + todo，不写 notes）
Phase 2 · 写 JSON 落盘
Phase 3 · validate → repair（≤3 轮）
Phase 4 · create_midi → render_audio
Phase 5 · 确认文件 + 交付摘要
```

### Phase 0 · 需求澄清

| 参数 | 默认 | 范围 |
|------|------|------|
| 调性 | C major | C/G/F major；A/E/D minor |
| 拍号 | 4/4 | 4/4, 3/4, 2/4, 6/8 |
| tempo | 72 | 40–200 |
| 时长 | 见 §5 模板 | 与小节数一致 ±10% |
| 情绪 | calm | 写入 metadata.mood |
| 伴奏 | arpeggio | root / root_fifth / octave / arpeggio |

用户只说「写一首钢琴曲」→ 用 **8 小节标准模板（§5.2）**，不反复追问。

### Phase 1 · 规划（先骨架，后填音）

**固定 todo（todo_write）：**

1. `[ ]` 规划 structure + chords + 时长
2. `[ ]` 写 `piano_output/<slug>.json`
3. `[ ]` validate（含 repair）
4. `[ ]` create_midi + render_audio
5. `[ ]` 确认三件套并回复用户

**铁律：先 `structure + chords`，再 `notes`。禁止先堆 notes 再补 structure。**

### Phase 2 · 写 JSON

- 路径：`piano_output/<slug>.json`（slug = 小写英文+下划线）
- **仅右手** `notes`（`hand: "right"`）
- **本 skill 强制必填：** `title`, `metadata`, **`structure`**, `chords`, `accompaniment`, `notes`

需要骨架时 `read_file` 本 skill 目录下模板：

- `templates/composition-4bar.json` — 超短 demo
- `templates/composition-8bar.json` — **默认**
- `templates/composition-12bar.json` — 完整小品

参考合法样例：`projects/piano-composition-agent/fixtures/quiet_evening.json`

### Phase 3 · validate → repair

```
validate → 若 valid:false → 按 reference/validate-errors.md 改 JSON → 再 validate
最多 3 轮；仍失败 → 向用户说明阻塞性 errors，停止 create_midi
```

### Phase 4 · 出文件

```
create_midi(composition)   # 仅 validate 通过后
render_audio(midi_path)    # 用 create_midi 返回的 file 路径
```

MCP 默认输出可能在 `piano-composition-agent/output/`；交付前确认用户工作区有：

- `piano_output/<slug>.json`
- `piano_output/<slug>.mid`
- `piano_output/<slug>.wav`

必要时 `cp` 到 `piano_output/`（不用 `rm`）。

### Phase 5 · 回复用户

简短包含：曲名、调性、BPM、小节数、pattern、三文件路径、1～2 句创作说明。

## 3. 曲式与整体组成

### 3.1 概念映射（像一封信）

| 信 | 钢琴小品 | JSON |
|----|----------|------|
| 开头 | 引入：建立调性，稍 sparse | structure 第 1 段前 1～2 小节；轻 velocity |
| 正文 | 主题呈现 + 对比 | structure A / B；chords 进行；notes 最完整 |
| 落款 | 收束：回主和弦、长音结束 | 最后 1～2 小节；根音/三音；duration 偏长 |

### 3.2 三层结构

```
① structure   — 段落名 + 小节号（Intro/A/B/A'/Outro）
② chords      — 和声骨架（左手由 MCP 按 pattern 展开）
③ notes       — 右手旋律 + velocity 弧线
```

### 3.3 段落职责

| 段 | 职责 | 旋律 | 力度 |
|----|------|------|------|
| Intro / A 前部 | 进入调性 | 少音、中音区 | velocity 60–68 |
| A 主题 | 主旋律最清晰 | 每小节 2～6 音 | 68–76 |
| B | 对比（和弦或音型变化） | 可略疏或换 rhythm | 66–74 |
| A' / Outro | 再现 + 终止 | 最后 1～2 小节长音 | 渐弱至 58–66 |

### 3.4 一致性规则（skill 强制，validator 不查）

- `structure` 中所有 bar 的并集 = `chords` 覆盖范围 = `notes` 的 max(bar)
- 不得出现「structure 写到 8 小节，notes 只有 4 小节」
- 全曲同一 `accompaniment.pattern`（V0.1 不切换）

## 4. Composition JSON 写作规范

### 4.1 最小结构

```json
{
  "title": "Human Readable Title",
  "metadata": {
    "tempo": 72,
    "key": "C major",
    "time_signature": "4/4",
    "mood": "calm, gentle",
    "target_duration_seconds": 27
  },
  "structure": [
    { "section": "A", "bars": [1, 2, 3, 4] },
    { "section": "B", "bars": [5, 6, 7, 8] }
  ],
  "chords": [
    { "bar": 1, "chord": "C" }
  ],
  "accompaniment": { "pattern": "arpeggio" },
  "notes": [
    {
      "hand": "right",
      "bar": 1,
      "beat": 1,
      "pitch": "E4",
      "duration": 1,
      "velocity": 70
    }
  ]
}
```

### 4.2 硬规则（validate 会拦）

| 规则 | 要求 |
|------|------|
| 右手音域 | **C4 – C6**（禁止 C6 以上，如 E6、D6） |
| pitch 格式 | `A4`, `C#5`, `Bb3` |
| 小节 beats | 4/4 下每 bar 内 beat+duration ≤ 4 |
| tempo | 40–200 |
| velocity | 1–127 |
| 时长 | `target_duration_seconds` 与估算 ±10% |

**时长公式：**

```
seconds ≈ max_bar × beats_per_bar × (60 / tempo)
4/4 → beats_per_bar = 4
例：8 小节 @72 BPM → 8 × 4 × (60/72) ≈ 26.7 → target 设 27
```

### 4.3 旋律写作要点

- 音高优先用 **当前和弦内音**（triad + 偶尔经过音）
- beat 从 **1.0** 起，常用 duration：`1`, `0.5`, `2`
- 避免每小节完全同一密度；**Outro 要明显收束**
- V0.1 不写左手 notes

### 4.4 accompaniment 选型

| pattern | 何时用 |
|---------|--------|
| `arpeggio` | **默认**；梦幻、流动 |
| `root` | 极简单、慢板 |
| `root_fifth` | 进行感 |
| `octave` | 略厚、支撑感 |

## 5. 默认曲式模板

### 5.1 超短 · 4 小节（demo / 测试）

- 时长：4/4 @72 → ~13s，`target_duration_seconds: 13`
- structure：`{ "section": "A", "bars": [1,2,3,4] }`
- chords 示例（Am）：Am – F – C – G
- notes：每小节 2～4 音；第 4 小节收束

### 5.2 标准 · 8 小节（**默认**）

- 时长：~27s @72，`target_duration_seconds: 27`
- structure：A(1–4) + B(5–8)
- bar 1–2：开头感（稍 sparse）；bar 3–4：A 主题；bar 5–6：B 对比；bar 7–8：收束
- chords 示例（C major）：A: C–G–Am–F；B: Dm–G–C–G

### 5.3 完整 · 12 小节（用户要「完整一首」）

- 时长：~40s @72，`target_duration_seconds: 40`
- structure：Intro(1–2) + A(3–6) + B(7–8) + A'(9–12)
- Intro 稀疏；A 主题完整；B 短对比；A' 再现 + bar 12 长音终止

## 6. 和声进行库（可直接选用）

**C major：** 温柔 `C–G–Am–F`；明亮 `C–Am–F–G`

**A minor：** 忧郁 `Am–F–C–G`；略张力 `Am–E–F–E`

**G major：** `G–Em–C–D`

每小节至少一条 `chords`；换段时可换进行，保持调性一致。

## 7. validate → repair 速查

| error type | 修复动作 |
|------------|----------|
| `SCHEMA_ERROR` | 对照 §4.1 补全字段、修正 pitch 格式 |
| `PITCH_OUT_OF_RANGE` | E6→E5，保持右手 C4–C6 |
| `INVALID_DURATION` | 减 duration 或挪 beat，使小节内 ≤ 4 beats |
| `DURATION_MISMATCH` | 改 target 或增减小节（用 §4.2 公式） |
| `INVALID_PITCH` | 改为 `[A-G](#\|b)?[0-9]` 格式 |

详细例子见 `reference/validate-errors.md`。repair 原则：只改 errors 指向的 bar/path；**不超过 3 轮**。

## 8. 反模式（禁止）

| 禁止 | 原因 |
|------|------|
| 未 load skill 就读 `music_mcp/*.py` | 浪费轮次 |
| 跳过 structure 直接写 notes | 曲式散、易超长 |
| 右手写出 C6 以上 | validate 必挂 |
| target 30s 只有 4 小节 | DURATION_MISMATCH |
| `bash rm` 清理 | permission 卡顿 |
| validate 未过就 create_midi | 浪费 |
| 任务进行中误以为是 p6 卡死 | 等完整回复后再输入下一句 |

## 9. 交付模板

**成功：**

```markdown
已完成《{title}》。

- 调性 / 拍号 / BPM：{key} · {time_signature} · {tempo}
- 结构：{structure 摘要}
- 文件：
  - piano_output/{slug}.json
  - piano_output/{slug}.mid
  - piano_output/{slug}.wav

可直接播放 .wav 试听。
```

**validate 3 轮仍失败：**

```markdown
作曲 JSON 在 {error_type} 上仍未通过校验。
当前阻塞：{errors 摘要}
建议：{具体改法或请用户放宽时长/小节数}
```
