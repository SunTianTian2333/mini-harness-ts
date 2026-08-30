# mini-harness-ts

TypeScript 极简 Agent Harness：Agent Loop + Tool Calling。对照 [learn-claude-code](../learn-claude-code/) s01 起步，分 Phase 扩展。

## 消息流

```text
用户输入
  → messages = [user, ...history]
  → LLM（Anthropic messages.create + tools）
  → 若有 tool_use：本地 executeTool → tool_result 写回 messages
  → 再调 LLM，直到 assistant 无 tool_use
  → 打印最终文本
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `src/main.ts` | CLI 入口 |
| `src/agent/loop.ts` | 核心 loop |
| `src/llm/client.ts` | Anthropic SDK 封装 |
| `src/tools/bash.ts` | bash tool schema + 执行 |
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

## 运行

```bash
cd /home/stt/agent-career/projects/mini-harness-ts
cp .env.example .env   # 若尚无 .env；填入 OPENAI_API_KEY
npm install
npm run dev
```

试例：

- `列出当前目录下的文件`
- `统计 src 目录有多少个 .ts 文件`

## Phase 规划

| Phase | 机制 | 状态 |
|-------|------|------|
| P1 | Agent Loop + bash | ✅ 当前 |
| P2 | read/write/glob + permission | 待做 |
| P3 | TodoWrite | 待做 |
| P4 | Skill Loading | 待做 |

Spec：`docs/mini-harness-ts/` · SDD 约束：[`AGENTS.md`](../../AGENTS.md) §mini-harness-ts

## 参考

- 项目文档：[`../../docs/mini-harness-ts/`](../../docs/mini-harness-ts/)
- learn-claude-code s01：`../learn-claude-code/s01_agent_loop/code.py`
- L1 概念：`../../docs/l1-agent-kernel/L1复习整合.md`
- 学习笔记：`../../learning/phase-3-harness-ts/README.md`
