# mini-harness-ts

TypeScript 极简 Agent Harness：Agent Loop + Tool Calling。对照 [learn-claude-code](../learn-claude-code/) s01 起步，分 Phase 扩展。

## 消息流

```text
用户输入
  → messages = [user, ...history]
  → LLM（OpenAI 兼容 API + tools）
  → Session 事件写入 .mini-harness/sessions.db（Hook subscriber）
  → PreToolUse（permission + [HOOK] log）→ executeTool → PostToolUse
  → PostToolBatch（todo reminder）
  → Stop hook 统计 tool 次数
  → system 含 skill catalog；模型可 load_skill 按需加载全文
  → 再调 LLM，直到 assistant 无 tool_calls
  → 打印最终文本
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `src/main.ts` | CLI 入口 |
| `src/agent/loop.ts` | 核心 loop |
| `src/session/` | SessionStore + SQLite + projectToMessages（P5b） |
| `src/hooks/` | s04 Hook + sessionLog subscriber（P5a/P5b） |
| `src/agent/tool-batch.ts` | 单轮 tool 执行；triggerHooks |
| `src/skill/loader.ts` | SkillLoader：扫描 catalog + load 全文 |
| `src/tools/skill.ts` | load_skill 工具 |
| `src/todo/manager.ts` | TodoManager 内存态 |
| `src/todo/reminder.ts` | rounds_since_todo 计数 |
| `src/tools/todo.ts` | todo_write 工具 |
| `src/llm/client.ts` | OpenAI 兼容 SDK 封装 |
| `src/tools/bash.ts` | bash 执行 |
| `src/tools/file.ts` | read / write / glob + safePath |
| `src/tools/index.ts` | tool schemas + dispatch（含 load_skill） |
| `src/runtime/paths.ts` | `.mini-harness/` 工作区路径（P5c） |
| `src/runtime/types.ts` | 类型与常量 |

## 模型 SDK

**默认：DeepSeek**（OpenAI 兼容 API，与 `mini-agent-loop` 同一套变量名）。

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | DeepSeek API Key（或其它兼容网关 Key） |
| `OPENAI_BASE_URL` | 默认 `https://api.deepseek.com/v1` |
| `OPENAI_MODEL` | 默认 `deepseek-chat` |

也可指向 OpenAI 官方：改 `OPENAI_BASE_URL=https://api.openai.com/v1` 和对应 model。

Harness 层逻辑：传 `messages` + `tools` → 收 `tool_calls` → 本地执行 → `role: tool` 回灌。

## 工作区布局（`.mini-harness/`）

运行时数据集中在项目根下的 `.mini-harness/`（仿 Hermes 式 dot 目录，不进 git）：

```text
.mini-harness/
├── .env              # API 密钥与模型配置
├── sessions.db       # Session 事件 log
└── skills/           # SKILL.md（可选；无则 catalog 为空）
    └── <name>/SKILL.md
```

## 运行

```bash
cd /home/stt/agent-career/projects/mini-harness-ts
mkdir -p .mini-harness
cp .env.example .mini-harness/.env   # 填入 OPENAI_API_KEY
npm install
npm run dev    # 新 session，写入 .mini-harness/sessions.db
npm run dev -- --resume <session_id>
npm run dev -- --list-sessions
npm test
```

试例（P5b）：

- 对话一轮 → 退出 → `--resume <id>` → 问「刚才我说了什么」

试例（P4）：

- `按 code-review skill 检查 src/tools/bash.ts`（应先 load_skill 再 read_file）
- `给 loop.ts 加一行注释，并更新 README 说明 P4 已完成`（todo_write + edit）

试例（P3）：

- `给 loop.ts 加一行注释，并更新 README 说明 P3 已完成`（应先 todo_write 再 edit）
- `用 glob 列出 src 下所有 .ts 文件`

## Phase 规划

| Phase | 机制 | 状态 |
|-------|------|------|
| P1 | Agent Loop + bash | ✅ |
| P2 | read/write/glob + permission | ✅ |
| P3 | TodoWrite | ✅ |
| P4 | Skill Loading | ✅ |
| P5a | s04 Hook 框架 | ✅ |
| P5b | Session + SQLite | ✅ |
| P5c | `.mini-harness/` 工作区布局 | ✅ |

## 概念覆盖（求职 / 口头讲解）

| 概念 | 本项目 | learn-claude-code |
|------|--------|-------------------|
| Agent Loop | ✅ `loop.ts` | s01 |
| Tool Calling | ✅ `tools/` | s02 |
| Permission | ✅ `hooks/permission.ts` | s03 → s04 Hook |
| Hook 扩展 | ✅ `hooks/registry.ts` | s04 |
| Todo / Reminder | ✅ `todo/` + PostToolBatch | s05 |
| Skill Loading | ✅ `skill/` + load_skill | s07 |
| Session 持久化 | ✅ `session/` + SQLite | —（对照 dsh L2） |
| Memory / MCP | ❌ trace only | s09 / s14 |

Spec：`docs/mini-harness-ts/` · SDD 约束：[`AGENTS.md`](../../AGENTS.md) §mini-harness-ts

## 参考

- 项目文档：[`../../docs/mini-harness-ts/`](../../docs/mini-harness-ts/)
- learn-claude-code s01：`../learn-claude-code/s01_agent_loop/code.py`
- L1 概念：`../../docs/l1-agent-kernel/L1复习整合.md`
- 学习笔记：`../../learning/phase-3-harness-ts/README.md`
