"use client";

import { useRef, useState } from "react";
import { useAsyncJob } from "../shared/jobs/use-async-job";
import { JobProgress } from "../shared/jobs/JobProgress";
import { DownloadResult } from "../shared/jobs/DownloadResult";
import { MediaSourcePicker } from "../shared/video/MediaSourcePicker";
import { TimelineTrimmer } from "../shared/video/TimelineTrimmer";
import { SubtitleEditor } from "../shared/video/SubtitleEditor";
import { SubtitleOverlay } from "../shared/video/SubtitleOverlay";
import { SubtitleStyleControls } from "../shared/video/SubtitleStyleControls";
import {
  EMPTY_SOURCE,
  DEFAULT_STYLE,
  MVP_FONT_FAMILY,
  type SourceValue,
  type TrimValue,
} from "../shared/video/types";
import type {
  Subtitle,
  StyleSpec,
  Job,
  JobStatus,
  Problem,
  TranscribeResult,
  RenderResult,
  TranscribeJobRequest,
  RenderJobRequest,
  LanguageCode,
} from "../shared/jobs/types";

type Phase =
  | "idle"
  | "transcribing"
  | "editing"
  | "rendering"
  | "done"
  | "error";

const DEFAULT_LANGUAGES: LanguageCode[] = [
  "en",
  "ja",
  "ko",
  "zh-Hans",
  "zh-Hant",
  "es",
  "fr",
  "de",
  "hi",
];

const DEFAULT_STRINGS = {
  heading: "YouTube Subtitle Studio",
  description: "Paste a YouTube link, get a translated subtitled video.",
  trimSection: "Trim (≤ {max} min)",
  translateSection: "Translate into",
  translateHint: "Pick zero or more target languages.",
  startButton: "Start",
  startingButton: "Starting...",
  editingHeading: "Edit & style",
  subtitleListHeading: "Subtitles",
  styleHeading: "Style",
  previewHeading: "Preview",
  previewSampleText: "The quick brown fox.",
  renderButton: "Render video",
  renderingButton: "Rendering...",
  resultHeading: "Done!",
  resultDownloadHint: "Click to save the rendered video.",
  startOverButton: "Start over",
  errorHeading: "Something went wrong",
  errorRetryButton: "Try again",
  cancelButton: "Cancel",
} as const;

interface SectionData {
  heading?: string;
  description?: string;
  apiBase: string;
  maxDurationSec?: number;
  supportedLanguages?: string[];
  strings?: Partial<typeof DEFAULT_STRINGS>;
}

interface Props {
  data: SectionData;
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

export function VideoSubtitleSection({ data, themeColor, darkMode }: Props) {
  const t = { ...DEFAULT_STRINGS, ...data.strings };
  const apiBase = data.apiBase.replace(/\/$/, "");
  const maxDurationSec = data.maxDurationSec ?? 300;
  const supportedLanguages = data.supportedLanguages ?? DEFAULT_LANGUAGES;

  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState<SourceValue>(EMPTY_SOURCE);
  const [trim, setTrim] = useState<TrimValue>({
    start_sec: 0,
    end_sec: maxDurationSec,
  });
  const [targetLangs, setTargetLangs] = useState<LanguageCode[]>(["en"]);

  const [transcribeJobId, setTranscribeJobId] = useState<string | null>(null);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [translations, setTranslations] = useState<Record<string, Subtitle[]>>({});
  const [style, setStyle] = useState<StyleSpec>(DEFAULT_STYLE);
  const [error, setError] = useState<Problem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const transcribe = useAsyncJob<TranscribeResult>({
    apiBase,
    jobId: transcribeJobId,
  });
  const render = useAsyncJob<RenderResult>({
    apiBase,
    jobId: renderJobId,
  });

  // ──────────── Render-phase reactions to job transitions ────────────
  // React 19 idiom: respond to upstream prop/state transitions during
  // render via prev-comparison gates rather than setState-in-effect.
  const [prevTStatus, setPrevTStatus] = useState<JobStatus | null>(null);
  const tStatus = transcribe.job?.status ?? null;
  if (tStatus !== prevTStatus) {
    setPrevTStatus(tStatus);
    if (tStatus === "completed" && transcribe.job?.result) {
      const r = transcribe.job.result;
      setSubtitles(r.segments);
      setTranslations(r.translations ?? {});
      const secondary = Object.keys(r.translations ?? {})[0];
      setStyle((prev) => ({
        ...prev,
        primary_language: r.language,
        secondary_language: secondary,
      }));
      setPhase("editing");
    } else if (tStatus === "failed" && transcribe.job?.error) {
      setError(transcribe.job.error);
      setPhase("error");
    }
  }

  const [prevTErr, setPrevTErr] = useState<Problem | null>(null);
  if (transcribe.error !== prevTErr) {
    setPrevTErr(transcribe.error);
    if (transcribe.error && phase === "transcribing") {
      setError(transcribe.error);
      setPhase("error");
    }
  }

  const [prevRStatus, setPrevRStatus] = useState<JobStatus | null>(null);
  const rStatus = render.job?.status ?? null;
  if (rStatus !== prevRStatus) {
    setPrevRStatus(rStatus);
    if (rStatus === "completed") {
      setPhase("done");
    } else if (rStatus === "failed" && render.job?.error) {
      setError(render.job.error);
      setPhase("error");
    }
  }

  const [prevRErr, setPrevRErr] = useState<Problem | null>(null);
  if (render.error !== prevRErr) {
    setPrevRErr(render.error);
    if (render.error && phase === "rendering") {
      setError(render.error);
      setPhase("error");
    }
  }

  // ──────────── Submit handlers ────────────
  const startTranscribe = async () => {
    if (!source.isValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const req: TranscribeJobRequest = {
      kind: "transcribe",
      input: {
        source: { type: "youtube_url", url: source.url, trim },
        asr: { language: "auto" },
        translation:
          targetLangs.length > 0
            ? { target_languages: targetLangs }
            : undefined,
      },
    };
    try {
      const res = await fetch(`${apiBase}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as Problem | null;
        throw new Error(
          body?.detail || body?.title || `Failed (${res.status})`,
        );
      }
      const body = (await res.json()) as Job<TranscribeResult>;
      setTranscribeJobId(body.id);
      setPhase("transcribing");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to start.");
    } finally {
      setSubmitting(false);
    }
  };

  const startRender = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const req: RenderJobRequest = {
      kind: "render",
      input: {
        source: { type: "youtube_url", url: source.url, trim },
        subtitles,
        translations:
          style.display === "bilingual" ? translations : undefined,
        style: { ...style, font_family: MVP_FONT_FAMILY },
      },
    };
    try {
      const res = await fetch(`${apiBase}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as Problem | null;
        throw new Error(
          body?.detail || body?.title || `Failed (${res.status})`,
        );
      }
      const body = (await res.json()) as Job<RenderResult>;
      setRenderJobId(body.id);
      setPhase("rendering");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to render.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPhase("idle");
    setSource(EMPTY_SOURCE);
    setTrim({ start_sec: 0, end_sec: maxDurationSec });
    setTargetLangs(["en"]);
    setTranscribeJobId(null);
    setRenderJobId(null);
    setSubtitles([]);
    setTranslations({});
    setStyle(DEFAULT_STYLE);
    setError(null);
    setSubmitError(null);
  };

  const toggleLang = (lc: LanguageCode) => {
    setTargetLangs((prev) =>
      prev.includes(lc) ? prev.filter((l) => l !== lc) : [...prev, lc],
    );
  };

  const trimDuration = trim.end_sec - trim.start_sec;
  const trimValid = trimDuration > 0 && trimDuration <= maxDurationSec;
  const canStart =
    phase === "idle" && source.isValid && trimValid && !submitting;

  const labelColor = darkMode ? "text-gray-300" : "text-gray-700";
  const subColor = darkMode ? "text-gray-400" : "text-gray-500";

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {(data.heading ?? t.heading) && (
          <h2
            className={`text-2xl md:text-3xl font-bold text-center ${
              darkMode ? "text-gray-100" : ""
            }`}
          >
            {data.heading ?? t.heading}
          </h2>
        )}
        {(data.description ?? t.description) && (
          <p className={`text-sm text-center ${subColor}`}>
            {data.description ?? t.description}
          </p>
        )}

        {/* ──────────── Phase: idle (URL + trim + langs) ──────────── */}
        {phase === "idle" && (
          <div className="space-y-6">
            <MediaSourcePicker
              value={source}
              onChange={setSource}
              themeColor={themeColor}
              darkMode={darkMode}
              disabled={submitting}
            />

            {source.isValid && (
              <>
                <div className="space-y-2">
                  <h3 className={`text-sm font-medium ${labelColor}`}>
                    {t.trimSection.replace(
                      "{max}",
                      String(Math.floor(maxDurationSec / 60)),
                    )}
                  </h3>
                  <TimelineTrimmer
                    value={trim}
                    onChange={setTrim}
                    maxDurationSec={maxDurationSec}
                    darkMode={darkMode}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className={`text-sm font-medium ${labelColor}`}>
                    {t.translateSection}
                  </h3>
                  <p className={`text-xs ${subColor}`}>{t.translateHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {supportedLanguages.map((lc) => {
                      const active = targetLangs.includes(lc);
                      return (
                        <button
                          key={lc}
                          type="button"
                          onClick={() => toggleLang(lc)}
                          disabled={submitting}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            active
                              ? "text-white border-transparent"
                              : darkMode
                                ? "bg-gray-800 text-gray-300 border-gray-600 hover:border-gray-500"
                                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                          style={
                            active ? { backgroundColor: themeColor } : undefined
                          }
                        >
                          {lc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={startTranscribe}
                    disabled={!canStart}
                    className="w-full text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ backgroundColor: themeColor }}
                  >
                    {submitting ? t.startingButton : t.startButton}
                  </button>
                  {submitError && (
                    <p className="mt-2 text-xs text-red-500 text-center">
                      {submitError}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ──────────── Phase: transcribing / rendering ──────────── */}
        {(phase === "transcribing" || phase === "rendering") && (
          <JobProgress
            job={phase === "transcribing" ? transcribe.job : render.job}
            themeColor={themeColor}
            darkMode={darkMode}
            onCancel={
              phase === "transcribing" ? transcribe.cancel : render.cancel
            }
            strings={{ cancel: t.cancelButton }}
          />
        )}

        {/* ──────────── Phase: editing ──────────── */}
        {phase === "editing" && (
          <div className="space-y-6">
            <h3 className={`text-lg font-semibold ${labelColor}`}>
              {t.editingHeading}
            </h3>

            <StylePreviewPane
              text={subtitles[0]?.text ?? t.previewSampleText}
              secondary={
                style.display === "bilingual" && style.secondary_language
                  ? translations[style.secondary_language]?.[0]?.text
                  : undefined
              }
              style={style}
              heading={t.previewHeading}
              labelColor={subColor}
              darkMode={darkMode}
            />

            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${labelColor}`}>
                {t.styleHeading}
              </h4>
              <SubtitleStyleControls
                value={style}
                onChange={setStyle}
                availableSecondaryLanguages={Object.keys(translations)}
                darkMode={darkMode}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${labelColor}`}>
                {t.subtitleListHeading}
              </h4>
              <SubtitleEditor
                subtitles={subtitles}
                onChange={setSubtitles}
                currentTimeSec={0}
                onSeek={() => {
                  // No live preview in MVP — seek is a no-op. Reserved for
                  // v2 once a preview URL is available.
                }}
                themeColor={themeColor}
                darkMode={darkMode}
                disabled={submitting}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={startRender}
                disabled={submitting || subtitles.length === 0}
                className="w-full text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ backgroundColor: themeColor }}
              >
                {submitting ? t.renderingButton : t.renderButton}
              </button>
              {submitError && (
                <p className="mt-2 text-xs text-red-500 text-center">
                  {submitError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ──────────── Phase: done ──────────── */}
        {phase === "done" && render.job?.result && (
          <DonePane
            fileUrl={render.job.result.file_url}
            fileName={
              transcribe.job?.result?.metadata?.title
                ? `${transcribe.job.result.metadata.title}.mp4`
                : "subtitled.mp4"
            }
            primary={subtitles}
            secondary={
              style.display === "bilingual" && style.secondary_language
                ? translations[style.secondary_language]
                : undefined
            }
            style={style}
            themeColor={themeColor}
            darkMode={darkMode}
            heading={t.resultHeading}
            description={t.resultDownloadHint}
            resetLabel={t.startOverButton}
            onReset={reset}
          />
        )}

        {/* ──────────── Phase: error ──────────── */}
        {phase === "error" && (
          <div
            className={`p-4 rounded-lg border ${
              darkMode
                ? "bg-red-900/20 border-red-700"
                : "bg-red-50 border-red-200"
            }`}
          >
            <h3 className="text-sm font-semibold text-red-600 mb-1">
              {t.errorHeading}
            </h3>
            {error && (
              <p
                className={`text-sm ${darkMode ? "text-red-300" : "text-red-700"}`}
              >
                {error.detail || error.title}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-3 text-sm underline text-red-600 hover:opacity-70"
            >
              {t.errorRetryButton}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components kept inline because they're tightly coupled to the
// section's phase logic and not reusable elsewhere.
// ──────────────────────────────────────────────────────────────────

function StylePreviewPane({
  text,
  secondary,
  style,
  heading,
  labelColor,
  darkMode,
}: {
  text: string;
  secondary?: string;
  style: StyleSpec;
  heading: string;
  labelColor: string;
  darkMode?: boolean;
}) {
  const bg = style.background ?? { shape: "none" };
  const borderRadius =
    bg.shape === "rounded" ? "8px" : bg.shape === "box" ? "2px" : "0";
  const padding = bg.shape && bg.shape !== "none" ? "0.25em 0.6em" : "0";

  const hexA = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(
      h.slice(2, 4),
      16,
    )},${parseInt(h.slice(4, 6), 16)},${a})`;
  };

  const background =
    bg.shape && bg.shape !== "none"
      ? hexA(bg.color ?? "#000000", bg.opacity ?? 0.5)
      : "transparent";

  const lineStyle: React.CSSProperties = {
    fontFamily: `"${style.font_family}", system-ui, sans-serif`,
    fontSize: `${Math.min(style.font_size_px, 36)}px`,
    color: style.color,
    background,
    borderRadius,
    padding,
    textShadow: `0 0 2px ${style.outline_color ?? "#000"}, 1px 1px 2px ${
      style.outline_color ?? "#000"
    }`,
    lineHeight: 1.3,
    display: "inline-block",
    maxWidth: "90%",
  };

  const verticalAlign =
    style.position === "top"
      ? "flex-start"
      : style.position === "middle"
        ? "center"
        : "flex-end";

  return (
    <div className="space-y-2">
      <h4 className={`text-xs ${labelColor}`}>{heading}</h4>
      <div
        className="relative w-full rounded-lg overflow-hidden"
        style={{
          aspectRatio: "16 / 9",
          backgroundColor: darkMode ? "#000000" : "#1f2937",
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center px-4 py-3 text-center gap-1"
          style={{ justifyContent: verticalAlign }}
        >
          <div style={lineStyle}>{text}</div>
          {secondary && (
            <div
              style={{
                ...lineStyle,
                fontSize: `${Math.min(style.font_size_px, 36) * 0.85}px`,
              }}
            >
              {secondary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DonePane({
  fileUrl,
  fileName,
  primary,
  secondary,
  style,
  themeColor,
  darkMode,
  heading,
  description,
  resetLabel,
  onReset,
}: {
  fileUrl: string;
  fileName: string;
  primary: Subtitle[];
  secondary?: Subtitle[];
  style: StyleSpec;
  themeColor: string;
  darkMode?: boolean;
  heading: string;
  description: string;
  resetLabel: string;
  onReset: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <div className="space-y-4">
      <h3
        className={`text-lg font-semibold text-center ${darkMode ? "text-gray-100" : ""}`}
      >
        {heading}
      </h3>
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={fileUrl}
          controls
          playsInline
          className="w-full"
        />
        <SubtitleOverlay
          videoRef={videoRef}
          primary={primary}
          secondary={secondary}
          style={style}
        />
      </div>
      <DownloadResult
        fileUrl={fileUrl}
        fileName={fileName}
        themeColor={themeColor}
        darkMode={darkMode}
        onReset={onReset}
        strings={{ resetButton: resetLabel }}
      >
        <p
          className={`text-sm ${darkMode ? "text-green-300" : "text-green-800"}`}
        >
          {description}
        </p>
      </DownloadResult>
    </div>
  );
}
