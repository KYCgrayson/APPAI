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
 * MVP locks the burned-in font to "Noto Sans" — installed on the backend
 * via Debian's fonts-noto-core (Latin) + fonts-noto-cjk (CJK) packages,
 * so no manual font setup is required. fontconfig auto-substitutes CJK
 * glyphs to "Noto Sans CJK JP/SC/TC" when needed.
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
