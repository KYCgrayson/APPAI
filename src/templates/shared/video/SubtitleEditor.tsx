"use client";

import { useState } from "react";

import type { Subtitle } from "../jobs/types";
import {
  isHighlighted,
  toggleHighlightRange,
  type HighlightRange,
} from "./types";

export interface SubtitleEditorStrings {
  emptyState?: string;
}

interface Props {
  subtitles: Subtitle[];
  onChange: (next: Subtitle[]) => void;
  /** The translation shown beside the original, when one is being burned. */
  secondary?: Subtitle[];
  onSecondaryChange?: (next: Subtitle[]) => void;
  /**
   * Marking replaces the text boxes with per-character targets.
   *
   * A separate mode because a textarea cannot draw an underline, and
   * because editing text after marking would shift every offset past the
   * edit — the marks would end up on the wrong characters.
   */
  marking?: boolean;
  currentTimeSec: number;
  onSeek: (sec: number) => void;
  themeColor: string;
  darkMode?: boolean;
  disabled?: boolean;
  strings?: SubtitleEditorStrings;
}

function fmtTime(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isActive(sub: Subtitle, currentTimeSec: number): boolean {
  return currentTimeSec >= sub.start && currentTimeSec < sub.end;
}

/** Which track a gesture belongs to — the two are marked independently. */
type Track = "primary" | "secondary";

interface Drag {
  track: Track;
  index: number;
  anchor: number;
  head: number;
}

export function SubtitleEditor({
  subtitles,
  onChange,
  secondary,
  onSecondaryChange,
  marking = false,
  currentTimeSec,
  onSeek,
  themeColor,
  darkMode,
  disabled,
  strings,
}: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);

  if (subtitles.length === 0) {
    return (
      <p className={`text-sm text-center py-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        {strings?.emptyState ?? "No subtitles yet."}
      </p>
    );
  }

  const trackOf = (track: Track) =>
    track === "primary" ? subtitles : (secondary ?? []);

  const commit = (track: Track, index: number, next: Subtitle) => {
    const list = trackOf(track).slice();
    list[index] = next;
    if (track === "primary") onChange(list);
    else onSecondaryChange?.(list);
  };

  const editText = (track: Track, index: number, text: string) => {
    const sub = trackOf(track)[index];
    // Marks are character offsets, so any edit invalidates them. Dropping
    // them is visible and predictable; keeping them would silently move the
    // emphasis onto whatever now sits at those positions.
    commit(track, index, { ...sub, text, highlights: undefined });
  };

  const endDrag = () => {
    const d = drag;
    if (!d) return;
    setDrag(null);
    const sub = trackOf(d.track)[d.index];
    if (!sub) return;
    const start = Math.min(d.anchor, d.head);
    const end = Math.max(d.anchor, d.head) + 1;
    const next = toggleHighlightRange(
      sub.highlights as HighlightRange[] | undefined,
      start,
      end,
    );
    commit(d.track, d.index, {
      ...sub,
      highlights: next.length > 0 ? next : undefined,
    });
  };

  const renderCell = (track: Track, index: number, sub: Subtitle) => {
    if (!marking) {
      return (
        <textarea
          value={sub.text}
          onChange={(e) => editText(track, index, e.target.value)}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none border-0 bg-transparent text-sm focus:outline-none focus:ring-0 ${
            darkMode ? "text-gray-100" : "text-gray-900"
          }`}
        />
      );
    }

    const chars = Array.from(sub.text);
    const ranges = sub.highlights as HighlightRange[] | undefined;
    const live =
      drag && drag.track === track && drag.index === index
        ? ([
            Math.min(drag.anchor, drag.head),
            Math.max(drag.anchor, drag.head) + 1,
          ] as HighlightRange)
        : null;

    return (
      <div
        // Per-character targets rather than the browser's own text
        // selection: this behaves identically under touch, and does not
        // summon the OS copy/paste bubble on top of what is being marked.
        className={`flex-1 text-sm select-none leading-relaxed ${
          darkMode ? "text-gray-100" : "text-gray-900"
        }`}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {chars.map((ch, ci) => {
          const marked =
            isHighlighted(ranges, ci) ||
            (live !== null && ci >= live[0] && ci < live[1]);
          return (
            <span
              key={ci}
              onPointerDown={(e) => {
                if (disabled) return;
                e.preventDefault();
                setDrag({ track, index, anchor: ci, head: ci });
              }}
              onPointerEnter={() => {
                if (drag && drag.track === track && drag.index === index) {
                  setDrag({ ...drag, head: ci });
                }
              }}
              className={`cursor-pointer ${
                marked ? "underline decoration-2 underline-offset-4" : ""
              }`}
              style={marked ? { textDecorationColor: themeColor } : undefined}
            >
              {ch}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`space-y-1 max-h-96 overflow-y-auto rounded-lg border ${
        darkMode ? "border-gray-700" : "border-gray-200"
      }`}
    >
      {subtitles.map((sub, i) => {
        const active = isActive(sub, currentTimeSec);
        const rowBase = "flex gap-3 p-2 transition-colors border-b last:border-b-0";
        const rowDark = darkMode ? "border-gray-700" : "border-gray-100";
        const rowActive = active
          ? darkMode
            ? "bg-gray-800"
            : "bg-amber-50"
          : "";
        const pair = secondary?.[i];
        return (
          <div key={i} className={`${rowBase} ${rowDark} ${rowActive}`}>
            <button
              type="button"
              onClick={() => onSeek(sub.start)}
              disabled={disabled}
              className={`text-xs font-mono shrink-0 mt-1 px-2 py-0.5 rounded transition-colors ${
                darkMode
                  ? "text-gray-400 hover:text-gray-100 hover:bg-gray-700"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
              style={active ? { color: themeColor } : undefined}
              aria-label={`Seek to ${fmtTime(sub.start)}`}
            >
              {fmtTime(sub.start)}
            </button>
            {renderCell("primary", i, sub)}
            {pair && (
              <div
                className={`flex-1 flex border-l pl-3 ${
                  darkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                {renderCell("secondary", i, pair)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
