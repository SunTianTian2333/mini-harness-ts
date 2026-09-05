import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { MabExportPayload } from "./types.js";

const BENCH_DIR = dirname(fileURLToPath(import.meta.url));

export type LoadMabOptions = {
  mabRoot: string;
  agentConfig: string;
  datasetConfig: string;
};

function resolvePython(mabRoot: string): string {
  const venvPython = join(mabRoot, ".venv", "bin", "python3");
  if (existsSync(venvPython)) {
    return venvPython;
  }
  return "python3";
}

export function loadMabDataset(options: LoadMabOptions): MabExportPayload {
  const mabRoot = resolve(options.mabRoot);
  const script = join(BENCH_DIR, "export_dataset.py");
  const python = resolvePython(mabRoot);

  const result = spawnSync(
    python,
    [
      script,
      "--mab-root",
      mabRoot,
      "--agent-config",
      options.agentConfig,
      "--dataset-config",
      options.datasetConfig,
    ],
    {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `MAB export failed (exit ${result.status}): ${result.stderr || result.stdout || "unknown error"}`,
    );
  }

  return JSON.parse(result.stdout) as MabExportPayload;
}

export const PRESETS = {
  "eventqa-smoke": {
    agentConfig: "configs/agent_conf/Long_Context_Agents/Long_context_agent_deepseek.yaml",
    datasetConfig: "configs/data_conf/Accurate_Retrieval/EventQA/Eventqa_64k_smoke.yaml",
  },
} as const;

export type BenchPreset = keyof typeof PRESETS;

export function defaultMabRoot(projectRoot: string): string {
  return resolve(projectRoot, "../MemoryAgentBench");
}
