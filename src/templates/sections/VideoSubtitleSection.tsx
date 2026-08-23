"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncJob } from "../shared/jobs/use-async-job";
import { JobProgress } from "../shared/jobs/JobProgress";
import { DownloadResult } from "../shared/jobs/DownloadResult";
import { MediaSourcePicker } from "../shared/video/MediaSourcePicker";
import { TimelineTrimmer } from "../shared/video/TimelineTrimmer";
import { SubtitleEditor } from "../shared/video/SubtitleEditor";
import { SubtitleOverlay } from "../shared/video/SubtitleOverlay";
import { AnnotationLayer } from "../shared/video/AnnotationLayer";
import { SubtitleStyleControls } from "../shared/video/SubtitleStyleControls";
import {
  EMPTY_SOURCE,
  DEFAULT_STYLE,
  MVP_FONT_FAMILY,
  langLabel,
  isScriptSibling,
  swapPrimaryScript,
  ANNOTATION_PRESETS,
  ANNOTATION_PRESET_ORDER,
  NOTE_DURATION_SEC,
  zhScriptOf,
  zhSiblingOf,
  type SourceValue,
  type TrimValue,
} from "../shared/video/types";
import type {
  Annotation,
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
  SubtitleFileUrls,
} from "../shared/jobs/types";

type Phase =
  | "idle"
  | "transcribing"
  | "editing"
  | "rendering"
  | "done"
  | "error";

// Default: the world's most-spoken languages, with Chinese split into
// Simplified + Traditional. Extra languages can still be passed via the
// section's `supportedLanguages`.
const DEFAULT_LANGUAGES: LanguageCode[] = [
  "en",
  "zh-Hans",
  "zh-Hant",
  "es",
  "hi",
  "ar",
];


const DEFAULT_STRINGS = {
  heading: "YouTube Subtitle Studio",
  description: "Paste a YouTube link, get a translated subtitled video.",
  trimSection: "Trim (≤ {max} min)",
  trimSectionUnlimited: "Trim",
  // Shown only to admins. Without it the sole hint that the cap is lifted is
  // the *absence* of "(≤ 5 min)" in the trim label — invisible unless you
  // already know what the non-admin label looks like.
  adminBadge: "Admin",
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
  editingBackButton: "← Back to recent projects",
  errorHeading: "Something went wrong",
  errorRetryButton: "Try again",
  cancelButton: "Cancel",
  // Progress stage labels. These live here, not in the backend, so a page can
  // localize them like every other string in this section.
  stageQueued: "Waiting in queue...",
  stageDownloading: "Downloading video...",
  stageTranscribing: "Transcribing audio...",
  stageTranslating: "Translating subtitles...",
  stageRendering: "Adding subtitles to the video...",
  stageFinalizing: "Finalizing...",
  recentHeading: "Recent projects",
  recentHint: "Reopen to restyle and render again — no new transcription, so it does not use your daily video.",
  recentSubtitleCount: "subtitles",
  detectedLanguage: "Detected source language: {language}",
  // Chinese only. Whisper writes whichever script it feels like, so without
  // this the burned-in original was never the user's to choose.
  scriptLabel: "Original script",
  scriptHans: "简体",
  scriptHant: "繁體",
  // Learning mode. Off by default and adds nothing to the editor until it
  // is on — the point is emphasis on a word or two, not a permanent mode.
  markingToggle: "Mark key words",
  // Re-reading the same clip a different way. A disappointing transcript
  // should not cost the URL, the trim and the language picks.
  sourceUsedWhisper: "Transcript: heard by Whisper",
  sourceUsedOriginal: "Transcript: the video's own subtitles ({lang})",
  sourceUsedAutoCaption: "Transcript: YouTube auto-captions ({lang})",
  rereadButton: "Read again",
  rereadHint:
    "Reads this same clip again — the link and trim are kept. Replaces the current subtitles, marks and notes, and counts as another transcription.",
  rereadWhisper: "Listen again (Whisper)",
  rereadTrackManual: "{lang} · uploaded",
  rereadTrackAuto: "{lang} · auto",
  rereadCancel: "Cancel",
  noteAdd: "+ note",
  noteHeading: "Note card",
  notePlaceholder: "Type the note — Enter for a new line",
  noteDelete: "Remove",
  noteHint: "Drag the card on the video to place it.",
  markingHint:
    "Drag across the characters to underline them. Tap a marked word to clear it. Editing a line clears its marks.",
  stalled: "Progress appears to be stuck. You can cancel or check the same job again.",
  checkAgain: "Check again",
} as const;

/**
 * A YouTube title turned into a filename the OS will actually accept.
 *
 * Titles routinely carry `/ \ : * ? " < > |`, which Windows rejects outright
 * and which the browser's `download` attribute treats as a path separator —
 * a title like "Ep 4: A/B testing" saved as "B testing.mp4", losing the rest.
 * Emoji and RTL marks survive fine and are left alone; only the characters
 * that break a save are touched.
 */
const FILENAME_MAX_STEM = 120;

export function downloadFileName(title: string | null | undefined): string {
  const stem = (title ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ") // control chars, incl. newlines
    .replace(/[/\\:*?"<>|]/g, " ") // reserved on Windows / path separators
    .replace(/\s+/g, " ")
    .trim()
    // Windows rejects a trailing dot or space, and a leading dot hides the file.
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, FILENAME_MAX_STEM)
    .trim()
    .replace(/[. ]+$/, "");

  return stem ? `${stem}.mp4` : "subtitled.mp4";
}

/* ──────────── Recent projects ────────────
 *
 * A finished run used to be deleted: the restore path treated `done` as
 * nothing worth keeping. That made restyling expensive in the one way that
 * matters — the connector bills `job.transcribe` and nothing else (1 video /
 * user / 24h), so re-rendering is free, but the only route back to the
 * subtitles was a fresh transcribe, which spends the day's quota on work
 * already done.
 *
 * Keeping the transcript locally turns "change the font and burn again" into
 * a free operation: reopen → restyle → render. The backend re-downloads the
 * clip if its 24h artifact TTL has passed; ASR and translation never re-run.
 */
const RECENTS_KEY = "appai-video-subtitle-recents-v1";
const RECENTS_MAX = 5;
/** Backend artifact TTL (redis_repo.JOB_TTL). Past it the job id is a 410. */
const BACKEND_TTL_MS = 24 * 60 * 60 * 1000;

interface RecentProject {
  id: string;
  savedAt: number;
  title: string | null;
  url: string;
  trim: TrimValue;
  targetLangs: LanguageCode[];
  style: StyleSpec;
  subtitles: Subtitle[];
  translations: Record<string, Subtitle[]>;
  transcribeJobId: string | null;
}

function loadRecents(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is RecentProject =>
        Boolean(r?.id && r?.url && Array.isArray(r?.subtitles) && r.subtitles.length),
    );
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentProject): RecentProject[] {
  // Upsert by id so re-rendering the same clip updates its entry (with the
  // latest style) instead of pushing a near-duplicate.
  const next = [entry, ...loadRecents().filter((r) => r.id !== entry.id)].slice(
    0,
    RECENTS_MAX,
  );
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — the list is a convenience, not state we must keep */
  }
  return next;
}

function relativeTime(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

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

export function VideoSubtitleSection({ data, themeColor, darkMode, isAdmin = false }: Props & { isAdmin?: boolean }) {
  const t = { ...DEFAULT_STRINGS, ...data.strings };
  const apiBase = data.apiBase.replace(/\/$/, "");
  const standardMaxDurationSec = data.maxDurationSec ?? 300;
  const maxDurationSec = isAdmin ? undefined : standardMaxDurationSec;
  const supportedLanguages = data.supportedLanguages ?? DEFAULT_LANGUAGES;

  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState<SourceValue>(EMPTY_SOURCE);
  const [trim, setTrim] = useState<TrimValue>({
    start_sec: 0,
    end_sec: standardMaxDurationSec,
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

  // Edit-phase live preview: plays the trimmed clean clip (result.clip_url)
  // with subtitles overlaid; the subtitle list follows / seeks the video.
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const [editTimeSec, setEditTimeSec] = useState(0);
  const [marking, setMarking] = useState(false);
  const [rereadOpen, setRereadOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedNote, setSelectedNote] = useState<number | null>(null);

  // Read on mount only: localStorage is not available during SSR, and the
  // list only changes through saveRecent()/restoreRecent() below.
  const [recents, setRecents] = useState<RecentProject[]>([]);
  useEffect(() => setRecents(loadRecents()), []);

  const restoreRecent = (r: RecentProject) => {
    setSource({ url: r.url, isValid: true, preview: null });
    setTrim(r.trim);
    setTargetLangs(r.targetLangs);
    setStyle(r.style);
    setSubtitles(r.subtitles);
    setTranslations(r.translations);
    setRenderJobId(null);
    setError(null);
    setSubmitError(null);
    // Re-attach to the transcribe job only while its artifacts can still
    // exist. Past the TTL the poll returns 410 and would drop the user into
    // the error phase; without it the editor falls back to a static preview,
    // which is the graceful outcome.
    const stillLive =
      r.transcribeJobId && Date.now() - r.savedAt < BACKEND_TTL_MS;
    setTranscribeJobId(stillLive ? r.transcribeJobId : null);
    setPhase("editing");
  };

  /**
   * Write the current run into the recents list.
   *
   * Called twice: once when the transcript first exists (so ASR and
   * translation survive an abandoned run) and again when a render finishes.
   * The second call is what makes reopening useful — the first one can only
   * store the default style, since the user has not opened the editor yet,
   * and without the render-time call a reopened project came back with the
   * fonts and colours reset no matter what was actually burned.
   *
   * `id` must be identical across both calls or the second banks a duplicate
   * instead of updating the first. `overrides` exists because the transcribe
   * call runs in the same render that computes the new subtitles and style,
   * before that state is committed.
   */
  const bankRecent = (overrides: Partial<RecentProject> = {}) => {
    const id =
      transcribeJobId ?? `${source.url}|${trim.start_sec}|${trim.end_sec}`;
    // A render can outlive the transcribe job's 24h TTL, at which point the
    // title is no longer fetchable — keep whatever the earlier call stored
    // rather than overwriting it with null.
    const previousTitle = loadRecents().find((r) => r.id === id)?.title ?? null;
    setRecents(
      saveRecent({
        id,
        savedAt: Date.now(),
        title: transcribe.job?.result?.metadata?.title ?? previousTitle,
        url: source.url,
        trim,
        targetLangs,
        style,
        subtitles,
        translations,
        transcribeJobId,
        ...overrides,
      }),
    );
  };

  // ── Persistence: survive page reloads (dev-server restarts force a full
  // reload and used to wipe the in-flight job → user came back to a blank
  // idle page while the backend had actually finished the work).
  // v2: font_size_px changed meaning (now px on a 1080-tall reference
  // canvas, not the source height), so a v1 style would restore a size
  // that no longer means what the user picked.
  const STORAGE_KEY = "appai-video-subtitle-state-v2";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      // Only resume genuinely in-flight work. A finished ("done") or errored
      // run should not trap a returning user — they get a fresh start.
      if (!s?.phase || s.phase === "idle" || s.phase === "done" || s.phase === "error") {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (s.source) setSource(s.source);
      if (s.trim) setTrim(s.trim);
      if (Array.isArray(s.targetLangs)) setTargetLangs(s.targetLangs);
      if (s.style) setStyle(s.style);
      if (Array.isArray(s.subtitles) && s.subtitles.length)
        setSubtitles(s.subtitles);
      if (s.translations) setTranslations(s.translations);
      if (s.transcribeJobId) setTranscribeJobId(s.transcribeJobId);
      if (s.renderJobId) setRenderJobId(s.renderJobId);
      setPhase(s.phase);
    } catch {
      /* corrupt state — start fresh */
    }
  }, []);
  useEffect(() => {
    try {
      if (phase === "idle") {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          phase,
          source,
          trim,
          targetLangs,
          style,
          subtitles,
          translations,
          transcribeJobId,
          renderJobId,
        }),
      );
    } catch {
      /* storage full/unavailable — non-fatal */
    }
  }, [
    phase,
    source,
    trim,
    targetLangs,
    style,
    subtitles,
    translations,
    transcribeJobId,
    renderJobId,
  ]);

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
      // Don't clobber restored/edited subtitles after a page reload.
      if (subtitles.length === 0) setSubtitles(r.segments);
      if (Object.keys(translations).length === 0)
        setTranslations(r.translations ?? {});
      // Skip the script sibling: it is the same sentence in the other
      // Chinese script, so defaulting to it would burn Chinese on both
      // lines instead of the translation the user actually asked for.
      const translationLangs = Object.keys(r.translations ?? {});
      const secondary =
        translationLangs.find((l) => !isScriptSibling(l, r.language)) ??
        translationLangs[0];
      const nextStyle = {
        ...style,
        primary_language: r.language,
        secondary_language: secondary,
      };
      setStyle(nextStyle);
      setPhase("editing");
      // Bank the transcript as soon as it exists, not at "done": the ASR and
      // translation are what cost quota, and an abandoned run should not
      // throw them away. The style stored here is only the default — the
      // render-completion call below replaces it with what was burned.
      bankRecent({
        title: r.metadata?.title ?? null,
        style: nextStyle,
        subtitles: subtitles.length ? subtitles : r.segments,
        translations: Object.keys(translations).length
          ? translations
          : (r.translations ?? {}),
      });
    } else if (tStatus === "failed" && transcribe.job?.error) {
      setError(transcribe.job.error);
      setPhase("error");
    } else if (tStatus === "cancelled") {
      setTranscribeJobId(null);
      setPhase("idle");
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
      // Update the entry with the style that was actually burned, so
      // reopening this project to restyle starts from what you last shipped
      // rather than from the defaults.
      bankRecent();
    } else if (rStatus === "failed" && render.job?.error) {
      setError(render.job.error);
      setPhase("error");
    } else if (rStatus === "cancelled") {
      setRenderJobId(null);
      setPhase("editing");
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
  /**
   * Submit a transcribe job for the current URL and trim.
   *
   * `transcript` lets the editor ask for a different read of the same clip
   * — the whole point being that a disappointing result should not cost the
   * user their URL, their trim and their language picks.
   */
  const startTranscribe = async (
    transcript?: TranscribeJobRequest["input"]["transcript"],
  ) => {
    if (!source.isValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const req: TranscribeJobRequest = {
      kind: "transcribe",
      input: {
        source: { type: "youtube_url", url: source.url, trim },
        asr: { language: transcript?.original_language ?? "auto" },
        transcript,
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
        // Empty stays undefined: an empty array would declare "this render
        // has annotations" and make the backend build bubble styles for none.
        annotations: annotations.length > 0 ? annotations : undefined,
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
    setTrim({ start_sec: 0, end_sec: standardMaxDurationSec });
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

  // ── Original script, Chinese only ───────────────────────────────────
  //
  // `subtitles` is the primary track and `translations` holds every other
  // one, so choosing the other script is a swap between the two — no
  // re-transcribe, no translation call, no quota. The backend converted the
  // sibling by table lookup when the job ran.
  const primaryLang = style.primary_language;
  const scriptSibling = zhSiblingOf(primaryLang);
  const canSwapScript =
    scriptSibling !== null && Array.isArray(translations[scriptSibling]);

  const swapScript = () => {
    const next = swapPrimaryScript({ subtitles, translations, style });
    if (!next) return;
    setSubtitles(next.subtitles);
    setTranslations(next.translations);
    setStyle(next.style);
  };

  // The translation being burned as line two. Shown beside the original in
  // the editor so a word and its translation can be marked together, which
  // is the whole point of the learning mode.
  const secondaryLang =
    style.display === "bilingual" ? style.secondary_language : undefined;
  const secondaryTrack = secondaryLang ? translations[secondaryLang] : undefined;

  // A note card is created from a subtitle line, so its times come from
  // that line and there is no timeline to pick or duration to choose. It is
  // independent afterwards. Seeking to the line makes the new card visible
  // straight away — otherwise it is created somewhere the playhead is not.
  const addAnnotation = (index: number) => {
    const sub = subtitles[index];
    if (!sub) return;
    const note: Annotation = {
      start: sub.start,
      // Fixed length, not the line's: a long line would leave the card on
      // screen well past the moment it is explaining. Clamped so a note on
      // the last line cannot run past the end of the clip.
      end: Math.min(sub.start + NOTE_DURATION_SEC, trim.end_sec - trim.start_sec),
      text: "",
      x: 0.5,
      y: 0.15,
      preset: "note",
    };
    setAnnotations((prev) => {
      setSelectedNote(prev.length);
      return [...prev, note];
    });
    const v = editVideoRef.current;
    if (v) {
      v.currentTime = sub.start;
      setEditTimeSec(sub.start);
    }
  };

  // The panel is shown for the selected note only while that note is on
  // screen, so panel and card appear and disappear together. Derived rather
  // than cleared on scrub: scrubbing back into range restores the selection.
  const visibleNote =
    selectedNote !== null &&
    annotations[selectedNote] &&
    editTimeSec >= annotations[selectedNote].start &&
    editTimeSec < annotations[selectedNote].end
      ? selectedNote
      : null;

  const updateNote = (index: number, patch: Partial<Annotation>) =>
    setAnnotations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );

  const removeNote = (index: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== index));
    setSelectedNote(null);
  };

  const transcribeMeta = transcribe.job?.result?.metadata;
  const availableTracks = transcribeMeta?.available_subtitles ?? [];

  const reread = (
    transcript: TranscribeJobRequest["input"]["transcript"],
  ) => {
    // Everything derived from the old transcript goes: marks are character
    // offsets into text that is about to change, and notes are pinned to
    // times that may not line up. Keeping them would be worse than losing
    // them — they would land on the wrong words.
    setRereadOpen(false);
    setSubtitles([]);
    setTranslations({});
    setAnnotations([]);
    setSelectedNote(null);
    setMarking(false);
    setRenderJobId(null);
    void startTranscribe(transcript);
  };

  const trimDuration = trim.end_sec - trim.start_sec;
  const trimValid = trimDuration > 0 && (maxDurationSec === undefined || trimDuration <= maxDurationSec);
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

        {isAdmin && (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                darkMode
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              <span aria-hidden="true">★</span>
              {t.adminBadge}
            </span>
          </div>
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

            {recents.length > 0 && (
              <div className="space-y-2">
                <h3 className={`text-sm font-medium ${labelColor}`}>
                  {t.recentHeading}
                </h3>
                <p className={`text-xs ${subColor}`}>{t.recentHint}</p>
                <ul className="space-y-1">
                  {recents.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => restoreRecent(r)}
                        disabled={submitting}
                        className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors disabled:opacity-50 ${
                          darkMode
                            ? "bg-gray-800 border-gray-700 hover:border-gray-500 text-gray-200"
                            : "bg-white border-gray-200 hover:border-gray-400 text-gray-800"
                        }`}
                      >
                        <span className="block truncate font-medium">
                          {r.title || r.url}
                        </span>
                        <span className={`block text-xs ${subColor}`}>
                          {fmtClock(r.trim.start_sec)}–{fmtClock(r.trim.end_sec)}
                          {" · "}
                          {r.subtitles.length} {t.recentSubtitleCount}
                          {" · "}
                          {relativeTime(r.savedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {source.isValid && (
              <>
                <div className="space-y-2">
                  <h3 className={`text-sm font-medium ${labelColor}`}>
                    {maxDurationSec === undefined
                      ? t.trimSectionUnlimited
                      : t.trimSection.replace("{max}", String(Math.floor(maxDurationSec / 60)))}
                  </h3>
                  <YouTubeTrimPicker
                    url={source.url}
                    trim={trim}
                    onChange={setTrim}
                    maxDurationSec={maxDurationSec}
                    themeColor={themeColor}
                    darkMode={darkMode}
                    disabled={submitting}
                  />
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
                          {langLabel(lc)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => startTranscribe()}
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
            isStalled={phase === "transcribing" ? transcribe.isStalled : render.isStalled}
            onResume={phase === "transcribing" ? transcribe.resume : render.resume}
            strings={{
              cancel: t.cancelButton,
              queued: t.stageQueued,
              downloading: t.stageDownloading,
              transcribing: t.stageTranscribing,
              translating: t.stageTranslating,
              rendering: t.stageRendering,
              uploading: t.stageFinalizing,
              stalled: t.stalled,
              checkAgain: t.checkAgain,
            }}
          />
        )}

        {/* ──────────── Phase: editing ──────────── */}
        {phase === "editing" && (
          <div className="space-y-6">
            <h3 className={`text-lg font-semibold ${labelColor}`}>
              {t.editingHeading}
            </h3>
            {transcribe.job?.result?.language && (
              <p className={`text-sm ${subColor}`}>
                {t.detectedLanguage.replace(
                  "{language}",
                  langLabel(transcribe.job.result.language),
                )}
              </p>
            )}

            {transcribeMeta?.transcript_origin && (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs ${subColor}`}>
                  {(transcribeMeta.transcript_origin === "original"
                    ? t.sourceUsedOriginal
                    : transcribeMeta.transcript_origin === "auto_caption"
                      ? t.sourceUsedAutoCaption
                      : t.sourceUsedWhisper
                  ).replace(
                    "{lang}",
                    langLabel(transcribe.job?.result?.language ?? ""),
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setRereadOpen((v) => !v)}
                  disabled={submitting}
                  className={`text-xs underline transition-colors ${
                    darkMode
                      ? "text-gray-400 hover:text-gray-100"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {rereadOpen ? t.rereadCancel : t.rereadButton}
                </button>
              </div>
            )}

            {rereadOpen && (
              <div
                className={`space-y-2 rounded-lg border p-2 ${
                  darkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <p className={`text-xs ${subColor}`}>{t.rereadHint}</p>
                <div className="flex flex-wrap gap-2">
                  {availableTracks.map((track) => (
                    <button
                      key={`${track.kind}-${track.lang}`}
                      type="button"
                      onClick={() =>
                        reread({
                          source:
                            track.kind === "manual" ? "original" : "auto_caption",
                          original_language: track.lang,
                        })
                      }
                      disabled={submitting}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        darkMode
                          ? "bg-gray-800 text-gray-300 border-gray-600 hover:border-gray-500"
                          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {(track.kind === "manual"
                        ? t.rereadTrackManual
                        : t.rereadTrackAuto
                      ).replace("{lang}", track.name || langLabel(track.lang))}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => reread({ source: "whisper" })}
                    disabled={submitting}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      darkMode
                        ? "bg-gray-800 text-gray-300 border-gray-600 hover:border-gray-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {t.rereadWhisper}
                  </button>
                </div>
              </div>
            )}

            {canSwapScript && (
              <div className="flex items-center gap-2">
                <span className={`text-xs ${subColor}`}>{t.scriptLabel}</span>
                <div className="flex gap-1">
                  {(["Hans", "Hant"] as const).map((sc) => {
                    const active = zhScriptOf(primaryLang) === sc;
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={active ? undefined : swapScript}
                        disabled={submitting}
                        aria-pressed={active}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-50 ${
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
                        {sc === "Hans" ? t.scriptHans : t.scriptHant}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {transcribe.job?.result?.clip_url ? (
              /* Live preview: real clip + subtitle overlay. Scrub the native
                 controls or click a subtitle row to jump. */
              <div className="space-y-1">
                <h4 className={`text-sm font-medium ${subColor}`}>
                  {t.previewHeading}
                </h4>
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video
                    ref={editVideoRef}
                    src={transcribe.job.result.clip_url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full"
                    onTimeUpdate={(e) =>
                      setEditTimeSec(e.currentTarget.currentTime)
                    }
                  />
                  <SubtitleOverlay
                    videoRef={editVideoRef}
                    primary={subtitles}
                    secondary={
                      style.display === "bilingual" && style.secondary_language
                        ? translations[style.secondary_language]
                        : undefined
                    }
                    style={style}
                  />
                  <AnnotationLayer
                    annotations={annotations}
                    onChange={setAnnotations}
                    currentTimeSec={editTimeSec}
                    selected={visibleNote}
                    onSelect={setSelectedNote}
                    subtitleFontSizePx={style.font_size_px}
                    disabled={submitting}
                  />
                </div>
              </div>
            ) : (
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
            )}

            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${labelColor}`}>
                {t.styleHeading}
              </h4>
              <SubtitleStyleControls
                value={style}
                onChange={setStyle}
                availableSecondaryLanguages={Object.keys(translations).filter(
                  (l) => !isScriptSibling(l, style.primary_language),
                )}
                darkMode={darkMode}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className={`text-sm font-medium ${labelColor}`}>
                  {t.subtitleListHeading}
                </h4>
                <label
                  className={`flex items-center gap-1.5 text-xs ${subColor}`}
                >
                  <input
                    type="checkbox"
                    checked={marking}
                    onChange={(e) => setMarking(e.target.checked)}
                    disabled={submitting}
                  />
                  {t.markingToggle}
                </label>
              </div>
              {marking && (
                <p className={`text-xs ${subColor}`}>{t.markingHint}</p>
              )}
              {visibleNote !== null && (
                <div
                  className={`space-y-2 rounded-lg border p-2 ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${labelColor}`}>
                      {t.noteHeading}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNote(visibleNote)}
                      disabled={submitting}
                      className="text-xs text-red-600 hover:opacity-70"
                    >
                      {t.noteDelete}
                    </button>
                  </div>
                  <textarea
                    value={annotations[visibleNote].text}
                    onChange={(e) =>
                      updateNote(visibleNote, { text: e.target.value })
                    }
                    placeholder={t.notePlaceholder}
                    disabled={submitting}
                    rows={2}
                    className={`w-full resize-y rounded-md border px-2 py-1 text-sm ${
                      darkMode
                        ? "bg-gray-800 border-gray-600 text-gray-100"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    {ANNOTATION_PRESET_ORDER.map((preset) => {
                      const look = ANNOTATION_PRESETS[preset];
                      const active =
                        (annotations[visibleNote].preset ?? "note") === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateNote(visibleNote, { preset })}
                          disabled={submitting}
                          aria-label={preset}
                          aria-pressed={active}
                          className={`h-6 w-6 rounded border-2 transition-colors ${
                            active ? "border-current" : "border-transparent"
                          }`}
                          style={{ backgroundColor: look.background }}
                        />
                      );
                    })}
                    <span className={`text-xs ${subColor}`}>{t.noteHint}</span>
                  </div>
                </div>
              )}
              <SubtitleEditor
                subtitles={subtitles}
                onChange={setSubtitles}
                secondary={secondaryTrack}
                onSecondaryChange={
                  secondaryLang
                    ? (next) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [secondaryLang]: next,
                        }))
                    : undefined
                }
                marking={marking}
                onAddAnnotation={addAnnotation}
                addAnnotationLabel={t.noteAdd}
                currentTimeSec={editTimeSec}
                onSeek={(sec) => {
                  const v = editVideoRef.current;
                  if (v) {
                    v.currentTime = sec;
                    setEditTimeSec(sec);
                  }
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
              {/* The only way out of `editing` that is not "render". Without
                  it this phase is a dead end: it is persisted across reloads
                  and restored on mount, and the recent-projects list renders
                  only in `idle` — so a user who left mid-edit came back to
                  `editing` on every visit with no route back to their own
                  projects. Reopening a recent project lands here too, which
                  made using that feature the way to lose access to it. */}
              <button
                type="button"
                onClick={reset}
                disabled={submitting}
                className={`mt-3 w-full text-sm underline disabled:opacity-50 hover:opacity-70 ${subColor}`}
              >
                {t.editingBackButton}
              </button>
            </div>
          </div>
        )}

        {/* ──────────── Phase: done ──────────── */}
        {phase === "done" && render.job?.result && (
          <DonePane
            fileUrl={render.job.result.file_url}
            fileName={downloadFileName(
              transcribe.job?.result?.metadata?.title,
            )}
            themeColor={themeColor}
            darkMode={darkMode}
            heading={t.resultHeading}
            description={t.resultDownloadHint}
            resetLabel={t.startOverButton}
            onReset={reset}
            subtitleFiles={transcribe.job?.result?.subtitle_files}
            clipUrl={transcribe.job?.result?.clip_url}
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
  themeColor,
  darkMode,
  heading,
  description,
  resetLabel,
  onReset,
  subtitleFiles,
  clipUrl,
}: {
  fileUrl: string;
  fileName: string;
  themeColor: string;
  darkMode?: boolean;
  heading: string;
  description: string;
  resetLabel: string;
  onReset: () => void;
  subtitleFiles?: Record<string, SubtitleFileUrls>;
  clipUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <div className="space-y-4">
      <h3
        className={`text-lg font-semibold text-center ${darkMode ? "text-gray-100" : ""}`}
      >
        {heading}
      </h3>
      {/* No SubtitleOverlay here, deliberately. This plays the *rendered*
          video, so its subtitles must come from the burn itself — drawing a
          DOM overlay on top made a broken burn look fine in the preview while
          the downloaded file had no subtitles at all. What you see here is
          exactly what the download contains. */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={fileUrl}
          controls
          playsInline
          className="w-full"
        />
      </div>
      <DownloadResult
        fileUrl={`${fileUrl}&dl=${encodeURIComponent(fileName)}`}
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

      {(clipUrl || (subtitleFiles && Object.keys(subtitleFiles).length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}
          >
            Extra downloads:
          </span>
          {Object.entries(subtitleFiles ?? {}).flatMap(([lang, files]) =>
            (
              [
                ["srt", files.srt],
                ["vtt", files.vtt],
              ] as const
            )
              .filter(([, u]) => !!u)
              .map(([ext, u]) => (
                <a
                  key={`${lang}.${ext}`}
                  // `download` attr is ignored cross-origin; the backend's
                  // ?dl= adds Content-Disposition: attachment instead.
                  href={`${u}&dl=${encodeURIComponent(`subtitles.${lang}.${ext}`)}`}
                  className="px-2 py-1 rounded border text-xs font-medium"
                  style={{ borderColor: themeColor, color: themeColor }}
                >
                  {lang}.{ext}
                </a>
              )),
          )}
          {clipUrl && (
            <a
              href={`${clipUrl}&dl=clip-no-subtitles.mp4`}
              className="px-2 py-1 rounded border text-xs font-medium"
              style={{ borderColor: themeColor, color: themeColor }}
            >
              clip (no subtitles).mp4
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────── YouTube trim picker ───────────────────────

const YT_ID_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;

function fmtClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Embedded YouTube player + "Set start / Set end" buttons.
 *
 * Uses the widget postMessage protocol directly (no external script, so it
 * passes CSP `script-src 'self'`): after a `listening` handshake the iframe
 * streams `infoDelivery` messages carrying `currentTime`; we also poll
 * `getCurrentTime` so the value stays fresh while paused.
 */
function YouTubeTrimPicker({
  url,
  trim,
  onChange,
  maxDurationSec,
  themeColor,
  darkMode,
  disabled,
}: {
  url: string;
  trim: TrimValue;
  onChange: (next: TrimValue) => void;
  maxDurationSec?: number;
  themeColor: string;
  darkMode?: boolean;
  disabled?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoId = url.match(YT_ID_RE)?.[1] ?? null;

  // Memoized on videoId only: the 500ms currentTime ticks re-render this
  // component, and the player element must never be recreated (a recreated
  // iframe reloads the video — looks like a page refresh).
  const player = useMemo(
    () =>
      videoId ? (
        <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            title="YouTube preview"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null,
    [videoId],
  );

  useEffect(() => {
    if (!videoId) return;
    const onMsg = (ev: MessageEvent) => {
      // Whole handler is defensive: window "message" traffic includes
      // devtools/extensions with exotic origins ("null", "") that would
      // make `new URL` throw — an uncaught error here pops the Next dev
      // overlay and looks like a page refresh.
      try {
        if (
          !/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(ev.origin).hostname)
        )
          return;
        const data =
          typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        const t = data?.info?.currentTime;
        if (typeof t === "number" && Number.isFinite(t)) setCurrentTime(t);
      } catch {
        /* non-JSON / non-YouTube noise — ignore */
      }
    };
    window.addEventListener("message", onMsg);
    const post = (payload: object) =>
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(payload),
        "*",
      );
    const poll = setInterval(() => {
      post({ event: "listening", id: "vs-trim", channel: "widget" });
      post({ event: "command", func: "getCurrentTime", args: [] });
    }, 500);
    return () => {
      window.removeEventListener("message", onMsg);
      clearInterval(poll);
    };
  }, [videoId]);

  if (!videoId) return null;

  const subColor = darkMode ? "text-gray-400" : "text-gray-500";
  const btnCls = `px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50`;

  const setStart = (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const s = Math.round(currentTime * 10) / 10;
    const end = trim.end_sec > s ? trim.end_sec : s + 60;
    onChange({ start_sec: s, end_sec: maxDurationSec === undefined ? end : Math.min(end, s + maxDurationSec) });
  };
  const setEnd = (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const e = Math.round(currentTime * 10) / 10;
    const start =
      trim.start_sec < e ? trim.start_sec : Math.max(0, e - 60);
    onChange({ start_sec: maxDurationSec === undefined ? start : Math.max(start, e - maxDurationSec), end_sec: e });
  };

  return (
    <div className="space-y-2">
      {player}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs tabular-nums ${subColor}`}>
          Player at {fmtClock(currentTime)}
        </span>
        <button
          type="button"
          onClick={setStart}
          disabled={disabled}
          className={btnCls}
          style={{ backgroundColor: themeColor }}
        >
          Set start = {fmtClock(currentTime)}
        </button>
        <button
          type="button"
          onClick={setEnd}
          disabled={disabled}
          className={btnCls}
          style={{ backgroundColor: themeColor }}
        >
          Set end = {fmtClock(currentTime)}
        </button>
        <span className={`text-xs ${subColor}`}>
          Play or scrub in the player, then capture the point.
        </span>
      </div>
    </div>
  );
}
