import type { Job } from "./types";

export const POLL_TIMEOUT_MS = 10_000;
export const STALE_AFTER_MS = 90_000;

export function jobProgressKey<TResult>(job: Job<TResult>): string {
  return `${job.progress?.stage ?? "queued"}:${job.progress?.percent ?? 0}`;
}

export function isJobStalled(lastProgressAt: number, now = Date.now()): boolean {
  return now - lastProgressAt >= STALE_AFTER_MS;
}

export function jobStatusUrl(apiBase: string, jobId: string): string {
  return `${apiBase}/jobs/${encodeURIComponent(jobId)}`;
}
