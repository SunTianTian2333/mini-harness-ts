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
  → Stop hook 统计 tool 次数 + memory extract（P6）
  → 每轮 LLM 前 prepareContext：budget → snip → micro/fit → auto compact（P7）
  → 每轮 LLM 前 LLM catalog 选型 recall（失败则 keyword fallback）注入 system
  → prompt_too_long 时 reactive compact 并重试一次（P7）
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
| `src/runtime/prompt.ts` | system prompt：skill catalog + memory recall（P6）+ compact 规则（P7） |
| `src/memory/` | Memory store / recall / extract / consolidate（P6） |
| `src/compact/` | Context compact：budget / snip / micro / fit / summarize（P7） |
| `src/mcp/` | MCP client、mock servers、动态 tool pool（P10） |
| `src/tools/connect-mcp.ts` | connect_mcp 工具（P10） |
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
├── skills/           # SKILL.md（可选；无则 catalog 为空）
│   └── <name>/SKILL.md
└── memory/           # 持久记忆（P6）
    ├── MEMORY.md     # 索引
    └── *.md          # 单条记忆
├── tool-results/     # 大 tool 输出落盘（P7）
├── transcripts/      # snip / compact 归档（P7）
└── mcp-servers.json  # MCP server 配置（P10b-1，可选）
```

**示例 Skill（进 git）：** `skills.example/piano-composition/`。复制到运行时目录后重启 CLI：

```bash
cp -r skills.example/piano-composition .mini-harness/skills/
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
npm run dev -- --strict-mcp   # autoConnect 失败时退出（默认仅警告）
npm test
```

## MCP 配置（P10b）

在 `.mini-harness/mcp-servers.json` 声明 MCP server；`autoConnect` 会在 CLI 启动时自动连接（无需模型先调 `connect_mcp`）。

```json
{
  "servers": {
    "docs": { "transport": "mock" },
    "music": {
      "transport": "stdio",
      "command": "python",
      "args": ["-m", "music_mcp"],
      "policy": {
        "validate_composition": "allow",
        "create_midi": "allow",
        "render_audio": "allow"
      }
    }
  },
  "autoConnect": ["music"]
}
```

| 字段 | 说明 |
|------|------|
| `transport: "mock"` | 内置 mock（`docs` / `deploy`） |
| `transport: "stdio"` | spawn 子进程，经 `@modelcontextprotocol/client` 通信 |
| `command` / `args` | stdio server 启动命令 |
| `cwd` / `env` | 可选；默认 cwd 为工作区根 |
| `policy` | 按 MCP 原始 tool 名覆盖 allow/confirm |
| `autoConnect` | 启动时自动 `connectMcp` 的 server 别名列表 |

启动成功时会打印 `Connected MCP servers: ...`。某 server 连接失败时默认打 `[mcp] autoConnect ... failed` 警告并继续；加 `--strict-mcp` 则任一失败即退出。

### Troubleshooting

| 现象 | 处理 |
|------|------|
| `failed to connect ... ENOENT` | 检查 `command` 是否在 PATH 中，或写绝对路径 |
| `Connection closed` | server 进程启动即退出；看 stderr（server 日志必须走 stderr，不能污染 stdout） |
| `Unknown server` in autoConnect | 确认 `autoConnect` 名与 `servers` 键一致，mock 名需在 `docs`/`deploy` 中 |
| invalid JSON in config | 降级为空配置；修正 `.mini-harness/mcp-servers.json` |
| 输入后无反应 / 无 `[HOOK] UserPromptSubmit` | 若刚出现过 `[permission] Allow? [y/N]`，先回答 y/n；仍异常则 Ctrl+C 重启（旧版双 readline bug 已修） |
| `[permission]` 等待很久 | Agent 在等确认，不是卡死；工作区内 `rm piano_output/...` 现已自动放行 |

试例（P6）：

- 先说「我偏好用 tab 缩进」→ 完成一轮 → 新 session 问「我缩进偏好是什么」（应 recall 相关 memory）

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
| P6 | Memory recall + extract + consolidate | ✅ |
| P7 | Context Compact（s08 对齐） | ✅ |
| P8 | Task System（s10 对齐） | ✅ |
| P9 | Background bash（s11 对齐） | ✅ |
| P11 | 多事件源 turn（s15 子集） | ✅ |
| P10 | MCP + 动态 tool pool（stdio + autoConnect） | ✅ |

## 待实现清单

> **各模块作用、依赖与推荐顺序：** [`../../docs/mini-harness-ts/待实现路线图.md`](../../docs/mini-harness-ts/待实现路线图.md)

| 优先级 | Phase / 章 | 机制 | 状态 |
|--------|------------|------|------|
| 1 | s06 | Subagent：`task` 工具、独立 messages 委派 | ⭐ 推荐下一项 |
| 2 | s12 | Cron：定时 prompt 入队（接 EventQueue） | 未排 Phase |
| 3 | s17 | Goal Loop：Stop 时独立 evaluator | 未排 Phase |
| 4 | s16 | Workflow：固定编排 + journal 续跑 | 未排 Phase |
| 5 | s13 | Agent Teams：Lead/Teammate + Task 板 | 未排 Phase |

**依赖：** s13 强依赖 P8；s12 可接 P11 EventQueue。

**暂未列入：** Error recovery 全量、Worktree、ConsoleBroker（见路线图 §5）。

## 概念覆盖（求职 / 口头讲解）

| 概念 | 本项目 | learn-claude-code |
|------|--------|-------------------|
| Agent Loop | ✅ `loop.ts` | s01 |
| Tool Calling | ✅ `tools/` | s02 |
| Permission | ✅ `hooks/permission.ts` | s03 → s04 Hook |
| Hook 扩展 | ✅ `hooks/registry.ts` | s04 |
| Todo / Reminder | ✅ `todo/` + PostToolBatch | s05 |
| Task System | ✅ `task/` + 6 tools | s10 |
| Background bash | ✅ `background/` + EventQueue 唤醒 | s11 |
| Integrated turn | ✅ `events/` + s15 子集 | s15 |
| Skill Loading | ✅ `skill/` + load_skill | s07 |
| Session 持久化 | ✅ `session/` + SQLite | —（对照 dsh L2） |
| Memory / MCP | ✅ memory（P6）；✅ MCP mock（P10） | s09 / s14 |
| Context Compact | ✅ compact/（P7） | s08 |

Spec：`docs/mini-harness-ts/` · SDD 约束：[`AGENTS.md`](../../AGENTS.md) §mini-harness-ts

## 参考

- 项目文档：[`../../docs/mini-harness-ts/`](../../docs/mini-harness-ts/)
- learn-claude-code s01：`../learn-claude-code/s01_agent_loop/code.py`
- L1 概念：`../../docs/l1-agent-kernel/L1复习整合.md`
- 学习笔记：`../../learning/phase-3-harness-ts/README.md`
