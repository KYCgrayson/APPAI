"use client";

import { useEffect, useState } from "react";

import type { Job, ProgressStage } from "./types";

export interface JobProgressStrings {
  cancel?: string;
  queued?: string;
  downloading?: string;
  transcribing?: string;
  translating?: string;
  rendering?: string;
  uploading?: string;
}

interface Props {
  job: Job | null;
  themeColor: string;
  darkMode?: boolean;
  onCancel?: () => void;
  strings?: JobProgressStrings;
}

// Plain language, not pipeline vocabulary: the visitor is waiting on their
// video, not watching a job runner. `strings` overrides these per locale.
const DEFAULT_LABELS: Record<ProgressStage, string> = {
  queued: "Waiting in queue...",
  downloading: "Downloading video...",
  transcribing: "Transcribing audio...",
  translating: "Translating subtitles...",
  rendering: "Adding subtitles to the video...",
  uploading: "Finalizing...",
};

export function JobProgress({
  job,
  themeColor,
  darkMode,
  onCancel,
  strings,
}: Props) {
  const stage: ProgressStage = job?.progress?.stage ?? "queued";
  const isRunning =
    job?.status === "queued" || job?.status === "processing";

  // Elapsed time is measured here rather than sent by the backend. It is data,
  // not copy — the backend used to fold it into `progress.message` ("Burning
  // subtitles · 15s"), which meant a backend English string won over the
  // localizable label below and leaked pipeline jargon into the UI.
  // The tick carries the stage it was measured in, so a stage change resets
  // the display without a setState in the effect body (cascading render).
  const [tick, setTick] = useState<{ stage: ProgressStage; sec: number } | null>(
    null,
  );
  useEffect(() => {
    if (!isRunning) return;
    const startedAt = Date.now();
    const id = setInterval(
      () => setTick({ stage, sec: Math.floor((Date.now() - startedAt) / 1000) }),
      1000,
    );
    return () => clearInterval(id);
  }, [stage, isRunning]);
  const elapsedSec = tick?.stage === stage ? tick.sec : 0;

  if (!job) return null;

  const percent = Math.max(0, Math.min(100, job.progress?.percent ?? 0));
  // Deliberately no `job.progress?.message` fallback — see the comment above.
  const label = strings?.[stage] ?? DEFAULT_LABELS[stage];
  const shownLabel =
    isRunning && elapsedSec > 0 ? `${label} · ${elapsedSec}s` : label;

  const trackBg = darkMode ? "#374151" : "#e5e7eb";
  const textColor = darkMode ? "#d1d5db" : "#4b5563";

  const isCancellable = isRunning;

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between text-sm"
        style={{ color: textColor }}
      >
        <span>{shownLabel}</span>
        <span aria-hidden="true">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={shownLabel}
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: trackBg }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: themeColor }}
        />
      </div>
      {isCancellable && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs underline hover:opacity-70"
          style={{ color: textColor }}
        >
          {strings?.cancel ?? "Cancel"}
        </button>
      )}
    </div>
  );
}
