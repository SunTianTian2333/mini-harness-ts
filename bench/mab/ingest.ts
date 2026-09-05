import { extractMemoriesFromText } from "../../src/memory/extract.js";

export type IngestStats = {
  chunks: number;
  storedRecords: number;
};

export async function ingestContextChunks(cwd: string, chunks: string[]): Promise<IngestStats> {
  let storedRecords = 0;
  for (const chunk of chunks) {
    storedRecords += await extractMemoriesFromText(cwd, chunk);
  }
  return {
    chunks: chunks.length,
    storedRecords,
  };
}
