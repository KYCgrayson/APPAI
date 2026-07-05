"use client";

import type { Subtitle } from "../jobs/types";

export interface SubtitleEditorStrings {
  emptyState?: string;
}

interface Props {
  subtitles: Subtitle[];
  onChange: (next: Subtitle[]) => void;
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

export function SubtitleEditor({
  subtitles,
  onChange,
  currentTimeSec,
  onSeek,
  themeColor,
  darkMode,
  disabled,
  strings,
}: Props) {
  if (subtitles.length === 0) {
    return (
      <p className={`text-sm text-center py-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        {strings?.emptyState ?? "No subtitles yet."}
      </p>
    );
  }

  const editText = (index: number, text: string) => {
    const next = subtitles.slice();
    next[index] = { ...next[index], text };
    onChange(next);
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
            <textarea
              value={sub.text}
              onChange={(e) => editText(i, e.target.value)}
              disabled={disabled}
              rows={1}
              className={`flex-1 resize-none border-0 bg-transparent text-sm focus:outline-none focus:ring-0 ${
                darkMode ? "text-gray-100" : "text-gray-900"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
