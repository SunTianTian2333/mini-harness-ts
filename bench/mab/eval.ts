import type { BenchResultRow } from "./types.js";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOutput(output: string): string {
  const trimmed = output.trim();
  const quoted = trimmed.match(/^["'](.+)["']$/s);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }
  const labelMatch = trimmed.match(/(?:answer|response|event)[:\s]+(.+)/i);
  if (labelMatch?.[1]) {
    return labelMatch[1].trim();
  }
  return trimmed;
}

function tokenF1(prediction: string, reference: string): number {
  const predTokens = normalizeText(prediction).split(" ").filter(Boolean);
  const refTokens = normalizeText(reference).split(" ").filter(Boolean);
  if (predTokens.length === 0 || refTokens.length === 0) {
    return predTokens.length === refTokens.length ? 1 : 0;
  }
  const predCounts = new Map<string, number>();
  for (const token of predTokens) {
    predCounts.set(token, (predCounts.get(token) ?? 0) + 1);
  }
  let overlap = 0;
  for (const token of refTokens) {
    const count = predCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      predCounts.set(token, count - 1);
    }
  }
  const precision = overlap / predTokens.length;
  const recall = overlap / refTokens.length;
  if (precision + recall === 0) {
    return 0;
  }
  return (2 * precision * recall) / (precision + recall);
}

function answerList(answer: string | string[]): string[] {
  if (Array.isArray(answer)) {
    return answer.map(String);
  }
  return [String(answer)];
}

export function scoreEventQa(output: string, answer: string | string[]): {
  parsed_output: string;
  exact_match: boolean;
  f1: number;
  substring_exact_match: boolean;
  eventqa_recall: number;
} {
  const answers = answerList(answer);
  const parsed = parseOutput(output);
  const predictionLower = output.toLowerCase();
  const parsedLower = parsed.toLowerCase();

  const recallScore =
    answers.length === 0
      ? 0
      : answers.filter((element) => predictionLower.includes(element.toLowerCase())).length / answers.length;
  const eventqaRecall = recallScore === 1 ? 1 : 0;

  const primary = answers[0] ?? "";
  const exactMatch = normalizeText(parsed) === normalizeText(primary);
  const substringExactMatch = answers.some(
    (element) => parsedLower.includes(element.toLowerCase()) || predictionLower.includes(element.toLowerCase()),
  );
  const f1 = tokenF1(parsed, primary);

  return {
    parsed_output: parsed,
    exact_match: exactMatch,
    f1,
    substring_exact_match: substringExactMatch,
    eventqa_recall: eventqaRecall,
  };
}

export function appendMetrics(
  metrics: Record<string, Array<boolean | number>>,
  row: BenchResultRow,
): void {
  const pairs: Array<[string, boolean | number]> = [
    ["exact_match", row.exact_match],
    ["f1", row.f1],
    ["substring_exact_match", row.substring_exact_match],
    ["eventqa_recall", row.eventqa_recall],
    ["input_len", row.input_len],
    ["output_len", row.output_len],
    ["memory_construction_time", row.memory_construction_time],
    ["query_time_len", row.query_time_len],
  ];
  for (const [key, value] of pairs) {
    if (!metrics[key]) {
      metrics[key] = [];
    }
    metrics[key].push(value);
  }
}

export function averageMetrics(metrics: Record<string, Array<boolean | number>>): Record<string, number> {
  const averaged: Record<string, number> = {};
  for (const [key, values] of Object.entries(metrics)) {
    if (values.length === 0) {
      continue;
    }
    const numeric = values.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value));
    const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    if (key.includes("_len") || key.includes("_time")) {
      averaged[key] = mean;
    } else {
      averaged[key] = mean * 100;
    }
  }
  return averaged;
}
