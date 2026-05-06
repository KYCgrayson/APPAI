/**
 * TypeScript types mirroring docs/video-subtitle/api-spec.yaml.
 *
 * Source of truth: the OpenAPI spec. If the spec changes, regenerate or
 * hand-update these types and bump the spec's `info.version`.
 */

export type LanguageCode = string;

export type JobKind = "transcribe" | "render";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ProgressStage =
  | "queued"
  | "downloading"
  | "transcribing"
  | "translating"
  | "rendering"
  | "uploading";

export interface Progress {
  stage: ProgressStage;
  percent: number;
  message?: string;
}

export interface Subtitle {
  id?: number;
  start: number;
  end: number;
  text: string;
}

export interface Trim {
  start_sec: number;
  end_sec: number;
}

export interface Source {
  type: "youtube_url";
  url?: string;
  trim?: Trim;
}

export interface StyleSpec {
  display?: "single" | "bilingual";
  primary_language: LanguageCode;
  secondary_language?: LanguageCode;
  font_family: string;
  font_size_px: number;
  color: string;
  outline_color?: string;
  background?: {
    shape?: "none" | "box" | "rounded";
    color?: string;
    opacity?: number;
  };
  position: "top" | "middle" | "bottom";
  animation?: "none" | "fade" | "slide_up";
}

export interface TranscribeJobRequest {
  kind: "transcribe";
  input: {
    source: Source;
    asr?: { language?: LanguageCode | "auto" };
    translation?: { target_languages?: LanguageCode[] };
  };
}

export interface RenderJobRequest {
  kind: "render";
  input: {
    source: Source;
    subtitles: Subtitle[];
    translations?: Record<string, Subtitle[]>;
    style: StyleSpec;
  };
}

export type JobRequest = TranscribeJobRequest | RenderJobRequest;

export interface TranscribeResult {
  metadata?: {
    title?: string;
    thumbnail_url?: string;
    source_duration_sec?: number;
  };
  duration_sec: number;
  language: LanguageCode;
  segments: Subtitle[];
  translations?: Record<string, Subtitle[]>;
  vtt_urls?: Record<string, string>;
}

export interface RenderResult {
  file_url: string;
  file_size_bytes?: number;
  duration_sec?: number;
  expires_at: string;
}

export type JobResult = TranscribeResult | RenderResult;

export type ProblemCode =
  | "validation_failed"
  | "source_unavailable"
  | "source_too_long"
  | "asr_failed"
  | "translation_failed"
  | "render_failed"
  | "rate_limited"
  | "job_expired"
  | "upstream_timeout";

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: ProblemCode;
}

export interface Job<TResult = JobResult> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress?: Progress;
  created_at: string;
  completed_at?: string | null;
  expires_at?: string;
  result?: TResult | null;
  error?: Problem | null;
}

export type TranscribeJob = Job<TranscribeResult> & { kind: "transcribe" };
export type RenderJob = Job<RenderResult> & { kind: "render" };

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);
