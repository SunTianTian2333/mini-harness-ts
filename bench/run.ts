import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { config as loadEnv } from "dotenv";

import { runLoop } from "../src/agent/loop.js";
import { emptyToolPool } from "./empty-tool-pool.js";
import { appendMetrics, averageMetrics, scoreEventQa } from "./mab/eval.js";
import { ingestContextChunks } from "./mab/ingest.js";
import {
  defaultMabRoot,
  loadMabDataset,
  PRESETS,
  type BenchPreset,
} from "./mab/load.js";
import type { BenchResultRow, BenchResultsFile, TelemetryEntry } from "./mab/types.js";
import { setupBenchHooks } from "../src/hooks/setup.js";
import { getModelId } from "../src/llm/client.js";
import { MemoryStore } from "../src/memory/store.js";
import { ensureMiniHarnessRoot, getEnvPath } from "../src/runtime/paths.js";
import type { ChatMessage } from "../src/runtime/types.js";
import { initSkillLoader } from "../src/skill/loader.js";

type CliOptions = {
  preset: BenchPreset;
  mabRoot: string;
  maxQueries: number;
  projectRoot: string;
};

function parseArgs(argv: string[]): CliOptions {
  const projectRoot = process.cwd();
  let preset: BenchPreset = "eventqa-smoke";
  let mabRoot = defaultMabRoot(projectRoot);
  let maxQueries = 3;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preset" && argv[index + 1]) {
      const value = argv[index + 1] as BenchPreset;
      if (!(value in PRESETS)) {
        throw new Error(`Unknown preset: ${value}`);
      }
      preset = value;
      index += 1;
    } else if (arg === "--mab-root" && argv[index + 1]) {
      mabRoot = resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--max-queries" && argv[index + 1]) {
      maxQueries = Number.parseInt(argv[index + 1], 10);
      index += 1;
    }
  }

  if (!Number.isFinite(maxQueries) || maxQueries <= 0) {
    throw new Error("--max-queries must be a positive integer");
  }

  return { preset, mabRoot, maxQueries, projectRoot };
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function seedWorkspaceEnv(ctxCwd: string, sourceEnvPath: string): void {
  ensureMiniHarnessRoot(ctxCwd);
  if (sourceEnvPath) {
    try {
      copyFileSync(sourceEnvPath, getEnvPath(ctxCwd));
    } catch {
      /* optional */
    }
  }
  loadEnv({ path: getEnvPath(ctxCwd), override: true });
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function runBench(options: CliOptions): Promise<string> {
  const presetConfig = PRESETS[options.preset];
  const payload = loadMabDataset({
    mabRoot: options.mabRoot,
    agentConfig: presetConfig.agentConfig,
    datasetConfig: presetConfig.datasetConfig,
  });

  const runId = `${timestampSlug()}-${options.preset}`;
  const runDir = join(options.projectRoot, "bench-runs", runId);
  mkdirSync(runDir, { recursive: true });

  const sourceEnvPath = getEnvPath(options.projectRoot);
  loadEnv({ path: sourceEnvPath });

  const agentConfig = {
    ...payload.agent_config,
    model: getModelId(),
    agent_name: "mini_harness_memory_agent",
    output_dir: "./outputs/mini-harness",
  };
  const datasetConfig = {
    ...payload.dataset_config,
    max_test_queries: options.maxQueries,
  };

  writeFileSync(
    join(runDir, "config.json"),
    JSON.stringify(
      {
        run_id: runId,
        preset: options.preset,
        mab_root: options.mabRoot,
        model: getModelId(),
        max_queries: options.maxQueries,
      },
      null,
      2,
    ),
    "utf-8",
  );

  const results: BenchResultRow[] = [];
  const metrics: Record<string, Array<boolean | number>> = {};
  const telemetry: TelemetryEntry[] = [];
  const timeCost: number[] = [];
  const benchStart = Date.now();

  let globalQueryIndex = 0;

  for (let contextIndex = 0; contextIndex < payload.contexts.length; contextIndex += 1) {
    if (globalQueryIndex >= options.maxQueries) {
      break;
    }

    const ctxCwd = join(runDir, `ctx-${contextIndex}`);
    mkdirSync(ctxCwd, { recursive: true });
    seedWorkspaceEnv(ctxCwd, sourceEnvPath);
    initSkillLoader(ctxCwd);

    const chunks = payload.contexts[contextIndex] ?? [];
    const qaItems = payload.query_answer_pairs[contextIndex] ?? [];

    console.log(`\n[bench] context ${contextIndex}: ingesting ${chunks.length} chunk(s)...`);
    const ingestStart = Date.now();
    const ingestStats = await ingestContextChunks(ctxCwd, chunks);
    const ingestElapsed = (Date.now() - ingestStart) / 1000;
    const memoryCount = MemoryStore.forCwd(ctxCwd).listRecords().length;
    console.log(
      `[bench] ingest done: ${ingestStats.chunks} chunks, ${memoryCount} memory record(s), ${ingestElapsed.toFixed(1)}s`,
    );

    for (let queryIndex = 0; queryIndex < qaItems.length; queryIndex += 1) {
      if (globalQueryIndex >= options.maxQueries) {
        break;
      }

      const item = qaItems[queryIndex];
      const benchHooks = setupBenchHooks();
      const history: ChatMessage[] = [];
      const queryStart = Date.now();

      console.log(`[bench] query ${globalQueryIndex} (${item.qa_pair_id ?? "no-id"})...`);
      const output = await runLoop(history, ctxCwd, item.query, { toolPool: emptyToolPool() });
      const queryTimeSec = (Date.now() - queryStart) / 1000;
      timeCost.push((Date.now() - benchStart) / 1000);

      const scored = scoreEventQa(output, item.answers);
      const row: BenchResultRow = {
        output,
        input_len: estimateTokens(item.query),
        output_len: estimateTokens(output),
        memory_construction_time: ingestElapsed,
        query_time_len: queryTimeSec,
        parsed_output: scored.parsed_output,
        exact_match: scored.exact_match,
        f1: scored.f1,
        substring_exact_match: scored.substring_exact_match,
        eventqa_recall: scored.eventqa_recall,
        answer: item.answers,
        query: item.query,
        query_id: globalQueryIndex,
        qa_pair_id: item.qa_pair_id,
      };
      results.push(row);
      appendMetrics(metrics, row);

      telemetry.push({
        context_index: contextIndex,
        query_index: queryIndex,
        qa_pair_id: item.qa_pair_id,
        memory_records_after_ingest: memoryCount,
        ingest_chunks: ingestStats.chunks,
        turns: benchHooks.getTurnCount(),
        query_time_sec: queryTimeSec,
      });

      console.log(
        `[bench]   substring_exact_match=${row.substring_exact_match} time=${queryTimeSec.toFixed(1)}s turns=${benchHooks.getTurnCount()}`,
      );
      globalQueryIndex += 1;
    }
  }

  const outputPayload: BenchResultsFile = {
    agent_config: agentConfig,
    dataset_config: datasetConfig,
    harness: {
      name: "mini-harness-ts",
      mode: "memory-ingest-qa",
      run_id: runId,
    },
    data: results,
    metrics,
    time_cost: timeCost,
    averaged_metrics: averageMetrics(metrics),
  };

  const resultsPath = join(runDir, "results.json");
  writeFileSync(resultsPath, JSON.stringify(outputPayload, null, 4), "utf-8");
  writeFileSync(join(runDir, "telemetry.jsonl"), telemetry.map((line) => JSON.stringify(line)).join("\n") + "\n", "utf-8");

  console.log(`\n[bench] done: ${results.length} query(s)`);
  console.log(`[bench] results: ${resultsPath}`);
  console.log(`[bench] substring_exact_match: ${outputPayload.averaged_metrics.substring_exact_match?.toFixed(1) ?? "n/a"}%`);

  return resultsPath;
}

runBench(parseArgs(process.argv)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
