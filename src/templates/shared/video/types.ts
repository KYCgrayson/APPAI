import type { Subtitle, StyleSpec } from "../jobs/types";

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
