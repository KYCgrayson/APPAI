"use client";

import { useEffect, useRef, useState } from "react";
import { type SourceValue, EMPTY_SOURCE } from "./types";

export interface MediaSourcePickerStrings {
  placeholder?: string;
  clearAriaLabel?: string;
  invalidUrl?: string;
  loadingPreview?: string;
  previewFailed?: string;
}

interface Props {
  value: SourceValue;
  onChange: (next: SourceValue) => void;
  themeColor: string;
  darkMode?: boolean;
  disabled?: boolean;
  strings?: MediaSourcePickerStrings;
}

const DEFAULTS: Required<MediaSourcePickerStrings> = {
  placeholder: "Paste a YouTube URL",
  clearAriaLabel: "Clear URL and paste from clipboard",
  invalidUrl: "Not a valid YouTube URL.",
  loadingPreview: "Loading preview...",
  previewFailed: "Could not load preview. You can still continue.",
};

const YOUTUBE_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;

function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url.trim());
}

export function MediaSourcePicker({
  value,
  onChange,
  themeColor,
  darkMode,
  disabled,
  strings,
}: Props) {
  const t = { ...DEFAULTS, ...strings };
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch oEmbed when URL becomes a valid YouTube link.
  useEffect(() => {
    if (!value.isValid || value.preview) return;

    const controller = new AbortController();
    setLoading(true);
    setPreviewError(null);

    fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(value.url)}&format=json`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`oEmbed ${res.status}`);
        const body = (await res.json()) as {
          title: string;
          author_name?: string;
          thumbnail_url: string;
        };
        onChange({
          ...value,
          preview: {
            title: body.title,
            author: body.author_name,
            thumbnail_url: body.thumbnail_url,
          },
        });
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setPreviewError(t.previewFailed);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // We deliberately exclude `onChange` and `t` to avoid re-fetch loops;
    // they are stable callers in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.url, value.isValid]);

  const setUrl = (raw: string) => {
    const url = raw.trim();
    onChange({
      url,
      isValid: isYoutubeUrl(url),
      preview: null,
    });
    setPreviewError(null);
  };

  const handleClearAndPaste = async () => {
    onChange(EMPTY_SOURCE);
    setPreviewError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(text);
    } catch {
      // Clipboard denied; keep empty.
    }
    inputRef.current?.focus();
  };

  const showInvalid = value.url.length > 0 && !value.isValid;
  const inputBase =
    "w-full border rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:ring-2";
  const inputDark = darkMode
    ? "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500"
    : "";

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="url"
          value={value.url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled}
          placeholder={t.placeholder}
          className={`${inputBase} ${inputDark} ${disabled ? "opacity-60" : ""}`}
          style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
        />
        {value.url && (
          <button
            type="button"
            onClick={handleClearAndPaste}
            disabled={disabled}
            aria-label={t.clearAriaLabel}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors disabled:opacity-40 ${
              darkMode
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="32"
            >
              <path d="M368 368L144 144M368 144L144 368" />
            </svg>
          </button>
        )}
      </div>

      {showInvalid && (
        <p className="text-xs text-red-500">{t.invalidUrl}</p>
      )}

      {loading && (
        <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          {t.loadingPreview}
        </p>
      )}

      {previewError && !loading && (
        <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          {previewError}
        </p>
      )}

      {value.preview && !loading && (
        <div
          className={`flex gap-3 p-3 rounded-lg border ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
          }`}
        >
          <img
            src={value.preview.thumbnail_url}
            alt=""
            className="w-32 h-20 object-cover rounded flex-shrink-0"
          />
          <div className="min-w-0 flex flex-col justify-center">
            <p
              className={`text-sm font-medium truncate ${darkMode ? "text-gray-100" : "text-gray-900"}`}
            >
              {value.preview.title}
            </p>
            {value.preview.author && (
              <p
                className={`text-xs truncate ${darkMode ? "text-gray-400" : "text-gray-500"}`}
              >
                {value.preview.author}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
