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
 * MVP locks the burned-in font to "Noto Sans". The backend runs on the
 * author's iMac (macOS); install via Homebrew:
 *   brew install --cask font-noto-sans font-noto-sans-cjk
 * fontconfig auto-substitutes "Noto Sans CJK JP/SC/TC" for CJK glyphs,
 * so this single family covers Latin + Japanese + Chinese.
 */
export const MVP_FONT_FAMILY = "Noto Sans";

export const DEFAULT_STYLE: StyleSpec = {
  display: "single",
  primary_language: "en",
  font_family: MVP_FONT_FAMILY,
  font_size_px: 28,
  color: "#ffffff",
  outline_color: "#000000",
  background: { shape: "none" },
  position: "bottom",
  animation: "none",
};

export type { Subtitle, StyleSpec };
