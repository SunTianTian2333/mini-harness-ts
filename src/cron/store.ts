import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { getCronsDir } from "../runtime/paths.js";
import { validateCron } from "./validate.js";
import { type CronJob, CRON_ID_PATTERN, isCronJob } from "./types.js";

const storeCache = new Map<string, CronStore>();

export class CronStore {
  private readonly jobs = new Map<string, CronJob>();

  constructor(private readonly cronsDir: string) {}

  static forCwd(cwd: string): CronStore {
    const cached = storeCache.get(cwd);
    if (cached) {
      return cached;
    }
    const dir = getCronsDir(cwd);
    mkdirSync(dir, { recursive: true });
    const store = new CronStore(dir);
    store.loadDurable();
    storeCache.set(cwd, store);
    return store;
  }

  static resetForTests(): void {
    storeCache.clear();
  }

  jobPath(jobId: string, createRoot = false): string {
    if (!CRON_ID_PATTERN.test(jobId)) {
      throw new Error(`Invalid cron job ID: ${jobId}`);
    }
    if (createRoot) {
      mkdirSync(this.cronsDir, { recursive: true });
    }
    const root = resolve(this.cronsDir);
    const path = resolve(root, `${jobId}.json`);
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Invalid cron job ID: ${jobId}`);
    }
    return path;
  }

  list(): CronJob[] {
    return [...this.jobs.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  get(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId);
  }

  schedule(
    cron: string,
    prompt: string,
    recurring = true,
    durable = true,
  ): CronJob | string {
    const cronError = validateCron(cron);
    if (cronError) {
      return cronError;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return "Prompt cannot be empty";
    }

    const job: CronJob = {
      id: this.allocateId(),
      cron: cron.trim(),
      prompt: trimmedPrompt,
      recurring,
      durable,
      pending_delivery: false,
      last_fired: null,
    };

    this.jobs.set(job.id, job);
    try {
      if (durable) {
        this.save(job);
      }
    } catch (error) {
      this.jobs.delete(job.id);
      throw error;
    }
    return job;
  }

  cancel(jobId: string): string {
    const job = this.jobs.get(jobId);
    if (!job) {
      return `Job ${jobId} not found`;
    }

    this.jobs.delete(jobId);
    try {
      if (job.durable) {
        this.deleteFile(jobId);
      }
    } catch (error) {
      this.jobs.set(jobId, job);
      throw error;
    }
    return `Cancelled ${jobId}`;
  }

  markDue(jobId: string, marker: string): CronJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const previousPending = job.pending_delivery;
    const previousLastFired = job.last_fired;
    job.pending_delivery = true;
    job.last_fired = marker;

    try {
      if (job.durable) {
        this.save(job);
      }
    } catch (error) {
      job.pending_delivery = previousPending;
      job.last_fired = previousLastFired;
      throw error;
    }
    return job;
  }

  ackDelivered(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    if (!job.recurring) {
      this.jobs.delete(jobId);
      if (job.durable) {
        this.deleteFile(jobId);
      }
      return;
    }

    job.pending_delivery = false;
    if (job.durable) {
      this.save(job);
    }
  }

  pendingJobs(): CronJob[] {
    return this.list().filter((job) => job.pending_delivery);
  }

  loadDurable(): number {
    let entries: string[];
    try {
      entries = readdirSync(this.cronsDir);
    } catch {
      return 0;
    }

    let loaded = 0;
    for (const entry of entries) {
      if (!entry.startsWith("cron_") || !entry.endsWith(".json")) {
        continue;
      }
      const jobId = entry.replace(/\.json$/, "");
      try {
        const raw = readFileSync(this.jobPath(jobId), "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        if (!isCronJob(parsed) || parsed.id !== jobId) {
          throw new Error("invalid cron job payload");
        }
        const cronError = validateCron(parsed.cron);
        if (cronError) {
          throw new Error(cronError);
        }
        if (!parsed.prompt.trim()) {
          throw new Error("prompt cannot be empty");
        }
        this.jobs.set(jobId, parsed);
        loaded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(`  [cron] skipped invalid saved job ${entry}: ${message}\n`);
      }
    }
    if (loaded > 0) {
      process.stdout.write(`  [cron] loaded ${loaded} durable job(s)\n`);
    }
    return loaded;
  }

  private allocateId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const jobId = `cron_${randomBytes(4).toString("hex")}`;
      if (!this.jobs.has(jobId)) {
        return jobId;
      }
    }
    throw new Error("Could not allocate a cron job ID");
  }

  private save(job: CronJob): void {
    const path = this.jobPath(job.id, true);
    const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(job, null, 2)}\n`, "utf-8");
    renameSync(tempPath, path);
  }

  private deleteFile(jobId: string): void {
    try {
      unlinkSync(this.jobPath(jobId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
