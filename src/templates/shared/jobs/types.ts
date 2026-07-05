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
  /** Bilingual secondary line size; defaults to 0.8 × font_size_px. */
  secondary_font_size_px?: number;
  color: string;
  outline_color?: string;
  background?: {
    shape?: "none" | "box" | "rounded";
    color?: string;
    opacity?: number;
  };
  position: "top" | "middle" | "bottom";
  animation?: "none" | "fade" | "fade_in" | "fade_out" | "slide_up";
}

export type TranscriptSource = "whisper" | "original" | "auto_caption";

export interface TranscribeJobRequest {
  kind: "transcribe";
  input: {
    source: Source;
    asr?: { language?: LanguageCode | "auto" };
    transcript?: {
      source?: TranscriptSource;
      original_language?: LanguageCode;
    };
    translation?: { target_languages?: LanguageCode[] };
  };
}

export interface RenderOutputOptions {
  end_fade_out_sec?: number;
}

export interface RenderJobRequest {
  kind: "render";
  input: {
    source: Source;
    subtitles: Subtitle[];
    translations?: Record<string, Subtitle[]>;
    style: StyleSpec;
    output?: RenderOutputOptions;
  };
}

export type JobRequest = TranscribeJobRequest | RenderJobRequest;

export interface SubtitleFileUrls {
  vtt?: string;
  srt?: string;
  ass?: string;
}

export interface TranscribeResult {
  metadata?: {
    title?: string;
    thumbnail_url?: string;
    source_duration_sec?: number;
    transcript_origin?: TranscriptSource;
  };
  /** Signed URL to the trimmed clean mp4 (no subtitles). */
  clip_url?: string;
  duration_sec: number;
  language: LanguageCode;
  segments: Subtitle[];
  translations?: Record<string, Subtitle[]>;
  /** Map of BCP-47 code → signed download URLs per format. */
  subtitle_files?: Record<string, SubtitleFileUrls>;
  /** @deprecated use `subtitle_files[lang].vtt`. */
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
  expires_at: string;
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

// ─────────────────── Source inspection / preview ───────────────────

export type SubtitleTrackKind = "manual" | "auto";

export interface SubtitleTrack {
  lang: LanguageCode;
  kind: SubtitleTrackKind;
  name?: string;
}

export interface SourceInfo {
  title?: string;
  duration_sec: number;
  thumbnail_url?: string;
  available_subtitles?: SubtitleTrack[];
}

export interface CompileSubtitlesRequest {
  subtitles: Subtitle[];
  translations?: Record<string, Subtitle[]>;
  style: StyleSpec;
}

export interface CompileSubtitlesResponse {
  ass_url: string;
}
