import type { Subtitle, StyleSpec, AnnotationPreset } from "../jobs/types";

export interface OEmbedData {
  title: string;
  author?: string;
  thumbnail_url: string;
}

export interface SourceValue {
  url: string;
  isValid: boolean;
  preview: OEmbedData | null;
}

export const EMPTY_SOURCE: SourceValue = {
  url: "",
  isValid: false,
  preview: null,
};

export interface TrimValue {
  start_sec: number;
  end_sec: number;
}

/**
 * Advisory. The backend honours this family only if it resolves on the render
 * host and has glyphs for the subtitle text; otherwise it substitutes a
 * covering family (PingFang TC first) and logs it. No install step needed.
 */
export const MVP_FONT_FAMILY = "Noto Sans";

/**
 * Every px size in a StyleSpec is authored against a canvas this many pixels
 * tall; the renderer scales that canvas to the real frame.
 *
 * Without a shared reference the same number means two different things:
 * libass sized it against the source height (28px = 2.6% of a 1080p frame)
 * while the preview sized it against the video box in the browser (28px = 8%
 * of a ~340px-tall element). The editor looked right and the download came
 * back with unreadably small subtitles. Both sides now divide by this.
 *
 * Keep in sync with SUBTITLE_REFERENCE_HEIGHT in the my-tools backend
 * (`app/pipeline/ffmpeg_burn.py`).
 */
export const SUBTITLE_REFERENCE_HEIGHT = 1080;

/** Secondary line size as a fraction of the primary, when not set explicitly. */
export const SECONDARY_FONT_RATIO = 0.8;

export const DEFAULT_STYLE: StyleSpec = {
  display: "single",
  primary_language: "en",
  font_family: MVP_FONT_FAMILY,
  // ~5% of frame height — the size mainstream subtitled video settles on.
  // Netflix/YouTube captions sit near 4.5%; below ~4% it stops being
  // comfortable on a phone.
  font_size_px: 54,
  color: "#ffffff",
  outline_color: "#000000",
  // A translucent plate rather than bare outlined text: outline alone fails
  // over light or busy footage, which is most of what gets subtitled here.
  // 55% keeps the picture readable through it.
  background: { shape: "rounded", color: "#000000", opacity: 0.55 },
  position: "bottom",
  animation: "none",
};

export type { Subtitle, StyleSpec };

// Friendly display labels for BCP-47 language codes — users see these,
// never the raw codes. Shared by the target-language picker and the
// bilingual secondary-language selector.
export const LANG_LABELS: Record<string, string> = {
  en: "English",
  "zh-Hans": "中文（简体）",
  "zh-Hant": "中文（繁體）",
  es: "Español",
  hi: "हिन्दी",
  ar: "العربية",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  it: "Italiano",
};

export function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

// ── Chinese script (Simplified ↔ Traditional) ───────────────────────────
//
// The backend reports the script Whisper actually wrote (`zh-Hant` or
// `zh-Hans`, never a bare `zh`) and ships the other one alongside in
// `translations`, converted by table lookup rather than translated. That
// turns "the burned-in original is whatever Whisper felt like" into a
// toggle. These helpers are what tells the two apart.

export type ZhScript = "Hans" | "Hant";

export function zhScriptOf(code: string | null | undefined): ZhScript | null {
  if (!code) return null;
  const parts = code.replace(/_/g, "-").toLowerCase().split("-");
  if (parts[0] !== "zh") return null;
  if (parts.includes("hans")) return "Hans";
  if (parts.includes("hant")) return "Hant";
  return null;
}

/** The same language in the other script — `zh-Hant` ⇄ `zh-Hans`. */
export function zhSiblingOf(code: string | null | undefined): string | null {
  const script = zhScriptOf(code);
  if (!script) return null;
  return script === "Hans" ? "zh-Hant" : "zh-Hans";
}

/**
 * Whether two codes are the same language in different scripts.
 *
 * Used to keep the script sibling out of the bilingual secondary picker:
 * offering it there would let both burned-in lines be Chinese — the same
 * sentence twice, once in each script — which is never what "bilingual"
 * is being asked for.
 */
export function isScriptSibling(a: string, b: string): boolean {
  const sa = zhScriptOf(a);
  const sb = zhScriptOf(b);
  return sa !== null && sb !== null && sa !== sb;
}

export interface ScriptSwapState {
  subtitles: Subtitle[];
  translations: Record<string, Subtitle[]>;
  style: StyleSpec;
}

/**
 * Promote the primary track's script sibling to primary.
 *
 * `subtitles` is the burned-in first line and `translations` holds every
 * other track, so switching between Simplified and Traditional is a swap
 * between the two — no re-transcribe, no translation call, no quota.
 *
 * Returns null when there is nothing to swap (not Chinese, or the sibling
 * was never produced — e.g. a backend without OpenCC installed).
 *
 * Pure so the two things that are easy to get wrong stay testable: the
 * outgoing track must be kept (it may carry hand edits), and the bilingual
 * secondary must not end up as the primary's other script, which would burn
 * the same sentence twice in two scripts instead of the translation.
 */
export function swapPrimaryScript(
  state: ScriptSwapState,
): ScriptSwapState | null {
  const primaryLang = state.style.primary_language;
  const sibling = zhSiblingOf(primaryLang);
  if (!sibling) return null;
  const incoming = state.translations[sibling];
  if (!incoming) return null;

  const translations = { ...state.translations };
  delete translations[sibling];
  translations[primaryLang] = state.subtitles;

  const secondary = state.style.secondary_language;
  const collides =
    secondary !== undefined &&
    (secondary === sibling || isScriptSibling(secondary, sibling));

  let style: StyleSpec = { ...state.style, primary_language: sibling };
  if (collides) {
    const fallback = Object.keys(translations).find(
      (l) => l !== sibling && !isScriptSibling(l, sibling),
    );
    style = fallback
      ? { ...style, secondary_language: fallback }
      : { ...style, secondary_language: undefined, display: "single" };
  }

  return { subtitles: incoming, translations, style };
}

// ── Highlight ranges ────────────────────────────────────────────────────
//
// Character ranges `[start, end)` into a subtitle's text, marking the word
// or phrase to emphasise. Positions rather than search terms: the same word
// twice in one line is two separate decisions, and string matching can tell
// neither them apart nor agree on what a "word" is across Chinese (no
// boundaries) and English (where `cat` would hit `category`).

export type HighlightRange = [number, number];

export function isHighlighted(
  ranges: HighlightRange[] | undefined,
  index: number,
): boolean {
  return (ranges ?? []).some(([s, e]) => index >= s && index < e);
}

/**
 * Add a range, or clear the one a single-character tap lands in.
 *
 * Marking and unmarking are the same gesture, so a tap inside an existing
 * mark removes it; anything wider adds. The result is kept sorted and
 * disjoint because that is what the renderer walks and what the backend
 * validates — overlapping ranges would emit nested spans.
 */
export function toggleHighlightRange(
  ranges: HighlightRange[] | undefined,
  start: number,
  end: number,
): HighlightRange[] {
  const current: HighlightRange[] = (ranges ?? []).map(([s, e]) => [s, e] as HighlightRange);
  if (end <= start) return current;

  if (end - start === 1) {
    const hit = current.findIndex(([s, e]) => start >= s && start < e);
    if (hit !== -1) {
      const out = current.slice();
      out.splice(hit, 1);
      return out;
    }
  }

  const sorted: HighlightRange[] = [
    ...current,
    [start, end] as HighlightRange,
  ].sort((a, b) => a[0] - b[0]);
  const out: HighlightRange[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    // `<=` also folds ranges that merely touch: [0,2] and [2,4] render the
    // same as [0,4] and one range is less to carry around.
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

// ── Note cards ─────────────────────────────────────────────────────────

/**
 * Fixed looks, mirroring `_BUBBLE_PRESETS` in the burn.
 *
 * Not free colours: a bubble has to read as a different kind of object from
 * a subtitle, and the background alone carries that — subtitles are a
 * translucent dark plate with light text, bubbles an opaque light card with
 * dark text. Each pair is a light ramp step with the 800 step of the same
 * hue on top, so contrast holds without hand-checking.
 */
export const ANNOTATION_PRESETS: Record<
  AnnotationPreset,
  { background: string; color: string }
> = {
  note: { background: "#FAEEDA", color: "#633806" },
  warm: { background: "#FAECE7", color: "#712B13" },
  cool: { background: "#E6F1FB", color: "#0C447C" },
  dark: { background: "#2C2C2A", color: "#F1EFE8" },
};

export const ANNOTATION_PRESET_ORDER: AnnotationPreset[] = [
  "note",
  "warm",
  "cool",
  "dark",
];

/** Matches `_BUBBLE_FONT_RATIO` / `_BUBBLE_MIN_FONT_PX` in the burn. */
export const BUBBLE_FONT_RATIO = 0.6;
export const BUBBLE_MIN_FONT_PX = 16;
