"use client";

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

const DEFAULT_LABELS: Record<ProgressStage, string> = {
  queued: "Waiting in queue...",
  downloading: "Downloading source...",
  transcribing: "Transcribing audio...",
  translating: "Translating subtitles...",
  rendering: "Rendering video...",
  uploading: "Finalizing...",
};

export function JobProgress({
  job,
  themeColor,
  darkMode,
  onCancel,
  strings,
}: Props) {
  if (!job) return null;

  const stage: ProgressStage = job.progress?.stage ?? "queued";
  const percent = Math.max(0, Math.min(100, job.progress?.percent ?? 0));
  const label =
    strings?.[stage] ?? job.progress?.message ?? DEFAULT_LABELS[stage];

  const trackBg = darkMode ? "#374151" : "#e5e7eb";
  const textColor = darkMode ? "#d1d5db" : "#4b5563";

  const isCancellable =
    job.status === "queued" || job.status === "processing";

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between text-sm"
        style={{ color: textColor }}
      >
        <span>{label}</span>
        <span aria-hidden="true">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
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
