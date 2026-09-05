export type MabQueryItem = {
  query: string;
  answers: string[];
  qa_pair_id: string | null;
};

export type MabExportPayload = {
  agent_config: Record<string, unknown>;
  dataset_config: Record<string, unknown>;
  contexts: string[][];
  query_answer_pairs: MabQueryItem[][];
};

export type BenchResultRow = {
  output: string;
  input_len: number;
  output_len: number;
  memory_construction_time: number;
  query_time_len: number;
  parsed_output: string;
  exact_match: boolean;
  f1: number;
  substring_exact_match: boolean;
  eventqa_recall: number;
  answer: string[];
  query: string;
  query_id: number;
  qa_pair_id: string | null;
};

export type BenchResultsFile = {
  agent_config: Record<string, unknown>;
  dataset_config: Record<string, unknown>;
  harness: {
    name: "mini-harness-ts";
    mode: "memory-ingest-qa";
    run_id: string;
  };
  data: BenchResultRow[];
  metrics: Record<string, Array<boolean | number>>;
  time_cost: number[];
  averaged_metrics: Record<string, number>;
};

export type TelemetryEntry = {
  context_index: number;
  query_index: number;
  qa_pair_id: string | null;
  memory_records_after_ingest: number;
  ingest_chunks: number;
  turns: number;
  query_time_sec: number;
};
