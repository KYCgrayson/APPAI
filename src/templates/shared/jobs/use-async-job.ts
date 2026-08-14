"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Job,
  type JobResult,
  type Problem,
  TERMINAL_STATUSES,
} from "./types";
import {
  POLL_TIMEOUT_MS,
  isJobStalled,
  jobProgressKey,
  jobStatusUrl,
} from "./polling-policy";

interface UseAsyncJobArgs {
  apiBase: string;
  jobId: string | null;
  pollIntervalMs?: number;
}

interface UseAsyncJobResult<TResult> {
  job: Job<TResult> | null;
  error: Problem | null;
  isPolling: boolean;
  isStalled: boolean;
  cancel: () => Promise<void>;
  resume: () => void;
}

const DEFAULT_POLL_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Polls `GET {apiBase}/jobs/{jobId}` every 2s while the job is non-terminal.
 * Conforms to docs/video-subtitle/api-spec.yaml.
 *
 * - Stops polling on `completed | failed | cancelled`.
 * - Surfaces 404 / 410 as a `Problem` per RFC 7807.
 * - Exponential back-off on transient network / 5xx errors.
 * - Aborts in-flight fetch on unmount or jobId change.
 */
export function useAsyncJob<TResult = JobResult>({
  apiBase,
  jobId,
  pollIntervalMs = DEFAULT_POLL_MS,
}: UseAsyncJobArgs): UseAsyncJobResult<TResult> {
  const [prevJobId, setPrevJobId] = useState<string | null>(jobId);
  const [job, setJob] = useState<Job<TResult> | null>(null);
  const [error, setError] = useState<Problem | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(jobId !== null);
  const [isStalled, setIsStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // React 19 idiom: reset state when a key prop changes by comparing during
  // render. Avoids `setState`-in-effect cascading renders.
  if (prevJobId !== jobId) {
    setPrevJobId(jobId);
    setJob(null);
    setError(null);
    setIsPolling(jobId !== null);
    setIsStalled(false);
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let unmounted = false;
    let failures = 0;
    let lastProgressKey: string | null = null;
    let lastProgressAt = Date.now();

    const tick = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, POLL_TIMEOUT_MS);
      try {
        const res = await fetch(
          jobStatusUrl(apiBase, jobId),
          { signal: controller.signal },
        );
        if (unmounted) return;

        if (res.status === 200) {
          const body = (await res.json()) as Job<TResult>;
          setJob(body);
          failures = 0;
          if (TERMINAL_STATUSES.has(body.status)) {
            setIsPolling(false);
            return;
          }
          const progressKey = jobProgressKey(body);
          if (progressKey !== lastProgressKey) {
            lastProgressKey = progressKey;
            lastProgressAt = Date.now();
          } else if (isJobStalled(lastProgressAt)) {
            setIsStalled(true);
            setIsPolling(false);
            return;
          }
        } else if (res.status === 404 || res.status === 410) {
          const body = (await res.json().catch(() => null)) as Problem | null;
          setError(
            body ?? {
              type: "about:blank",
              title: res.status === 410 ? "Job expired" : "Job not found",
              status: res.status,
              code: res.status === 410 ? "job_expired" : undefined,
            },
          );
          setIsPolling(false);
          return;
        } else {
          failures += 1;
        }
      } catch (e) {
        if (unmounted) return;
        if (e instanceof DOMException && e.name === "AbortError" && !timedOut)
          return;
        failures += 1;
      } finally {
        clearTimeout(timeout);
      }

      if (unmounted) return;
      if (isJobStalled(lastProgressAt)) {
        setIsStalled(true);
        setIsPolling(false);
        return;
      }
      const delay =
        failures > 0
          ? Math.min(pollIntervalMs * 2 ** failures, MAX_BACKOFF_MS)
          : pollIntervalMs;
      timerRef.current = setTimeout(tick, delay);
    };

    tick();

    return () => {
      unmounted = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [apiBase, jobId, pollIntervalMs, attempt]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsPolling(false);
    try {
      await fetch(jobStatusUrl(apiBase, jobId), {
        method: "DELETE",
      });
    } catch {
      // Best-effort; UI doesn't block on cancel.
    }
    setJob((j) => (j ? { ...j, status: "cancelled" } : j));
  }, [apiBase, jobId]);

  const resume = useCallback(() => {
    if (!jobId) return;
    setError(null);
    setIsStalled(false);
    setIsPolling(true);
    setAttempt((n) => n + 1);
  }, [jobId]);

  return { job, error, isPolling, isStalled, cancel, resume };
}
