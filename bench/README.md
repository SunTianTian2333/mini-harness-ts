# mini-harness MemoryAgentBench pilot

Requires sibling repo `../MemoryAgentBench` with Python venv.

```bash
# from projects/mini-harness-ts
cp .env.example .mini-harness/.env   # or reuse existing .mini-harness/.env

npm run bench -- --preset eventqa-smoke --max-queries 3
```

Outputs (gitignored):

```text
bench-runs/<timestamp>-eventqa-smoke/
  config.json
  results.json
  telemetry.jsonl
  ctx-0/.mini-harness/memory/
```

Compare with official Long Context results under `MemoryAgentBench/outputs/deepseek-chat/`.
