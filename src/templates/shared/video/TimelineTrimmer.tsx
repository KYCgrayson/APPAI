"use client";

import { useState } from "react";
import type { TrimValue } from "./types";

export interface TimelineTrimmerStrings {
  startLabel?: string;
  endLabel?: string;
  durationLabel?: string;
  rangeTooLong?: string;
  rangeInvalid?: string;
}

interface Props {
  value: TrimValue;
  onChange: (next: TrimValue) => void;
  maxDurationSec: number;
  darkMode?: boolean;
  disabled?: boolean;
  strings?: TimelineTrimmerStrings;
}

const DEFAULTS: Required<TimelineTrimmerStrings> = {
  startLabel: "Start",
  endLabel: "End",
  durationLabel: "Selected",
  rangeTooLong: "Range exceeds the {max}-minute limit.",
  rangeInvalid: "End must be after start.",
};

function fmtMSS(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseMSS(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const m = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/**
 * MVP trimmer: two M:SS inputs with constraint validation. A visual
 * dual-handle scrubber is a v2 concern — it requires the source's true
 * duration, which the spec doesn't yet expose without launching a
 * transcribe job. Numeric inputs work for the author-validation case
 * (transcribe a known 5-min clip).
 */
export function TimelineTrimmer({
  value,
  onChange,
  maxDurationSec,
  darkMode,
  disabled,
  strings,
}: Props) {
  const t = { ...DEFAULTS, ...strings };
  const [startText, setStartText] = useState(fmtMSS(value.start_sec));
  const [endText, setEndText] = useState(fmtMSS(value.end_sec));
  const [prevStart, setPrevStart] = useState(value.start_sec);
  const [prevEnd, setPrevEnd] = useState(value.end_sec);

  // React 19 idiom: sync local edit-buffer text with external value via
  // render-phase prev comparison instead of setState-in-effect.
  if (prevStart !== value.start_sec) {
    setPrevStart(value.start_sec);
    setStartText(fmtMSS(value.start_sec));
  }
  if (prevEnd !== value.end_sec) {
    setPrevEnd(value.end_sec);
    setEndText(fmtMSS(value.end_sec));
  }

  const commitStart = () => {
    const parsed = parseMSS(startText);
    if (parsed === null) {
      setStartText(fmtMSS(value.start_sec));
      return;
    }
    onChange({ ...value, start_sec: Math.max(0, parsed) });
  };

  const commitEnd = () => {
    const parsed = parseMSS(endText);
    if (parsed === null) {
      setEndText(fmtMSS(value.end_sec));
      return;
    }
    onChange({ ...value, end_sec: Math.max(0, parsed) });
  };

  const duration = value.end_sec - value.start_sec;
  const tooLong = duration > maxDurationSec;
  const invalid = duration <= 0;

  const inputBase =
    "w-24 border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2";
  const inputDark = darkMode
    ? "bg-gray-800 border-gray-600 text-gray-100"
    : "";
  const labelColor = darkMode ? "text-gray-400" : "text-gray-600";
  const errorMsg = tooLong
    ? t.rangeTooLong.replace("{max}", String(Math.floor(maxDurationSec / 60)))
    : invalid
      ? t.rangeInvalid
      : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className={`text-xs ${labelColor}`}>{t.startLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            onBlur={commitStart}
            disabled={disabled}
            className={`${inputBase} ${inputDark}`}
            placeholder="0:00"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`text-xs ${labelColor}`}>{t.endLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            onBlur={commitEnd}
            disabled={disabled}
            className={`${inputBase} ${inputDark}`}
            placeholder="5:00"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className={`text-xs ${labelColor}`}>{t.durationLabel}</span>
          <span
            className={`text-sm font-mono ${
              tooLong || invalid
                ? "text-red-500"
                : darkMode
                  ? "text-gray-200"
                  : "text-gray-800"
            }`}
          >
            {fmtMSS(Math.max(0, duration))}
          </span>
        </div>
      </div>
      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  );
}
