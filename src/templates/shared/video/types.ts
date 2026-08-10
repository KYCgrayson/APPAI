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
