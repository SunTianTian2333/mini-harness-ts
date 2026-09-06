export const CRON_ID_PATTERN = /^cron_[0-9a-f]{8}$/;

export type CronJob = {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  durable: boolean;
  pending_delivery: boolean;
  last_fired: string | null;
};

export function isCronJob(value: unknown): value is CronJob {
  if (!value || typeof value !== "object") {
    return false;
  }
  const job = value as CronJob;
  return (
    typeof job.id === "string" &&
    CRON_ID_PATTERN.test(job.id) &&
    typeof job.cron === "string" &&
    typeof job.prompt === "string" &&
    typeof job.recurring === "boolean" &&
    typeof job.durable === "boolean" &&
    typeof job.pending_delivery === "boolean" &&
    (job.last_fired === null || typeof job.last_fired === "string")
  );
}
