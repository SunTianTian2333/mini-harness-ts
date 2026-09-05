# validate → repair 参考

## SCHEMA_ERROR

**典型原因：** 缺 `title` / `metadata.tempo` / `chords` / `notes`；pitch 格式非法；多余字段。

**修复：**

- 对照 `composition.schema.json` 必填项补全
- pitch 必须是 `A4`、`C#5`、`Bb3` 等形式
- `additionalProperties: false`，不要加 schema 外字段

**示例：**

```json
// 错
"pitch": "e4"
// 对
"pitch": "E4"
```

## PITCH_OUT_OF_RANGE

**典型原因：** 右手写出 E6、D6、C7 等超出 C4–C6。

**修复：** 降八度，保持旋律轮廓：

| 错 | 对 |
|----|-----|
| E6 | E5 |
| D6 | D5 |
| C7 | C6（已是上限，改旋律） |

V0.1 只写右手，不要写 `hand: "left"` notes。

## INVALID_DURATION

**典型原因：** 4/4 小节内 beat + duration 超过 4 beats。

**示例（错）：**

```json
{ "bar": 1, "beat": 3, "duration": 2, ... }
// 3 + 2 = 5 > 4
```

**修复：**

- 减小 `duration`（如 2 → 1）
- 或把音符挪到下一小节（改 `bar` / `beat`）
- 或拆成两个较短音符

## DURATION_MISMATCH

**典型原因：** `target_duration_seconds` 与 `max_bar × beats × 60/tempo` 相差超过 10%。

**公式（4/4）：**

```
estimated = max_bar × 4 × (60 / tempo)
```

**常见组合：**

| max_bar | tempo | estimated | 建议 target |
|---------|-------|-----------|-------------|
| 4 | 72 | ~13.3s | 13 |
| 8 | 72 | ~26.7s | 27 |
| 12 | 72 | ~40.0s | 40 |
| 8 | 60 | ~32.0s | 32 |

**修复：** 优先改 `target_duration_seconds` 对齐估算值；若用户明确要求时长，则增减小节数。

## INVALID_PITCH

**典型原因：** 非法 pitch 字符串（如 `H4`、`C#`、`4C`）。

**修复：** 使用 `[A-G](#|b)?[0-9]`，例如 `F#4`、`Bb5`。

## repair 流程

1. 读 `validate_composition` 返回的 `errors[]`
2. 按 `type` + `bar` + `path` 定位 JSON 中的条目
3. 改 `piano_output/<slug>.json` 后再次 validate
4. 最多 3 轮；仍失败则向用户报告，不要强行 create_midi
