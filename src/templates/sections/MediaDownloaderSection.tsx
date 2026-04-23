"use client";

import { useRef, useState } from "react";

type Format = "video" | "mp3";
type VideoQuality = "2160" | "1080" | "720" | "480";
type Mp3Quality = "320" | "192" | "128";

export interface MediaDownloaderStrings {
  placeholder?: string;
  clearAriaLabel?: string;
  downloadButton?: string;
  downloadingButton?: string;
  formatLabel?: string;
  videoLabel?: string;
  mp3Label?: string;
  qualityLabel?: string;
  subtitlesLabel?: string;
  pastedMessage?: string;
  downloadingMessage?: string;
  saveFileButton?: string;
  genericError?: string;
  timeoutError?: string;
  downloadFailedError?: string;
}

const DEFAULT_STRINGS: Required<MediaDownloaderStrings> = {
  placeholder: "Paste URL",
  clearAriaLabel: "Clear URL and paste from clipboard",
  downloadButton: "Download",
  downloadingButton: "Processing...",
  formatLabel: "Format",
  videoLabel: "Video",
  mp3Label: "MP3",
  qualityLabel: "Quality",
  subtitlesLabel: "Subtitles",
  pastedMessage: "New URL pasted from clipboard — ready to download.",
  downloadingMessage: "Downloading and processing, please wait...",
  saveFileButton: "Save File",
  genericError: "Something went wrong",
  timeoutError: "Request timed out. The server took too long to respond.",
  downloadFailedError: "Download failed",
};

interface Props {
  data: {
    heading?: string;
    description?: string;
    apiBase: string;
    apiToken?: string;
    maxVideoQuality?: VideoQuality;
    strings?: MediaDownloaderStrings;
  };
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

export function MediaDownloaderSection({ data, themeColor, darkMode }: Props) {
  const t = { ...DEFAULT_STRINGS, ...data.strings };
  const maxVideo = Number(data.maxVideoQuality ?? "2160");
  const defaultVideoQuality: VideoQuality =
    720 <= maxVideo ? "720" : 480 <= maxVideo ? "480" : (data.maxVideoQuality ?? "480");

  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video");
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(defaultVideoQuality);
  const [mp3Quality, setMp3Quality] = useState<Mp3Quality>("320");
  const [subtitles, setSubtitles] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "downloading" | "ready" | "error" | "pasted"
  >("idle");
  const [result, setResult] = useState<{
    file_id: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    if (!url.trim()) return;

    setStatus("downloading");
    setError("");
    setResult(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const params = new URLSearchParams({
        url: url.trim(),
        format,
        quality: format === "video" ? videoQuality : mp3Quality,
        subtitles: subtitles ? "true" : "false",
      });
      const res = await fetch(`${data.apiBase}/download?${params}`, {
        method: "POST",
        headers: data.apiToken ? { token: data.apiToken } : {},
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).detail || (body as Record<string, string>).error || t.downloadFailedError,
        );
      }

      const body = await res.json();
      setResult(body);
      setStatus("ready");
    } catch (e: unknown) {
      let message = t.genericError;
      if (e instanceof DOMException && e.name === "AbortError") {
        message = t.timeoutError;
      } else if (e instanceof Error) {
        message = e.message;
      }
      setError(message);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleClearAndPaste = async () => {
    setUrl("");
    setStatus("idle");
    setResult(null);
    setError("");
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setStatus("pasted");
      }
    } catch {
      // clipboard read denied/unsupported — leave empty; user can paste manually
    }
    inputRef.current?.focus();
  };

  const handleFileDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    const fileUrl = new URL(`${data.apiBase}/file/${encodeURIComponent(result.file_id)}`);
    if (data.apiToken) fileUrl.searchParams.set("token", data.apiToken);
    link.href = fileUrl.toString();
    link.download = result.title || result.file_id;
    link.click();
  };

  const toggleClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? "text-white border-transparent"
        : darkMode
          ? "bg-gray-800 text-gray-300 border-gray-600 hover:border-gray-500"
          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
    }`;

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {data.heading && (
          <h2 className={`text-2xl md:text-3xl font-bold text-center mb-2 ${darkMode ? "text-gray-100" : ""}`}>
            {data.heading}
          </h2>
        )}
        {data.description && (
          <p className={`text-sm text-center mb-8 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            {data.description}
          </p>
        )}

        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:flex-1">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (status === "pasted") setStatus("idle");
                }}
                placeholder={t.placeholder}
                className={`w-full border rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:ring-2 ${
                  darkMode ? "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500" : ""
                }`}
                style={
                  { "--tw-ring-color": themeColor } as React.CSSProperties
                }
                onKeyDown={(e) => e.key === "Enter" && handleDownload()}
              />
              {url && (
                <button
                  type="button"
                  onClick={handleClearAndPaste}
                  disabled={status === "downloading"}
                  aria-label={t.clearAriaLabel}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
            <button
              onClick={handleDownload}
              disabled={status === "downloading" || !url.trim()}
              className="text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: themeColor }}
            >
              {status === "downloading" ? t.downloadingButton : t.downloadButton}
            </button>
          </div>

          <div className={`border rounded-xl p-4 space-y-4 ${darkMode ? "border-gray-700" : ""}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {t.formatLabel}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat("video")}
                  className={toggleClass(format === "video")}
                  style={
                    format === "video"
                      ? { backgroundColor: themeColor }
                      : undefined
                  }
                >
                  {t.videoLabel}
                </button>
                <button
                  onClick={() => setFormat("mp3")}
                  className={toggleClass(format === "mp3")}
                  style={
                    format === "mp3"
                      ? { backgroundColor: themeColor }
                      : undefined
                  }
                >
                  {t.mp3Label}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {t.qualityLabel}
              </span>
              <div className="flex flex-wrap gap-2 justify-end">
                {format === "video" ? (
                  <>
                    {(["4K", "1080p", "720p", "480p"] as const)
                      .filter((label) => {
                        const val =
                          label === "4K" ? "2160" : label.replace("p", "");
                        return Number(val) <= maxVideo;
                      })
                      .map((label) => {
                        const val =
                          label === "4K"
                            ? "2160"
                            : label.replace("p", "");
                        return (
                          <button
                            key={val}
                            onClick={() =>
                              setVideoQuality(val as VideoQuality)
                            }
                            className={toggleClass(videoQuality === val)}
                            style={
                              videoQuality === val
                                ? { backgroundColor: themeColor }
                                : undefined
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                  </>
                ) : (
                  <>
                    {(["320", "192", "128"] as const).map((val) => (
                      <button
                        key={val}
                        onClick={() => setMp3Quality(val as Mp3Quality)}
                        className={toggleClass(mp3Quality === val)}
                        style={
                          mp3Quality === val
                            ? { backgroundColor: themeColor }
                            : undefined
                        }
                      >
                        {val} kbps
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {format === "video" && (
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {t.subtitlesLabel}
                </span>
                <button
                  onClick={() => setSubtitles(!subtitles)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: subtitles ? themeColor : darkMode ? "#4b5563" : "#d1d5db",
                  }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      subtitles ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {status === "pasted" && (
            <p className={`text-sm text-center ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {t.pastedMessage}
            </p>
          )}

          {status === "downloading" && (
            <p className={`text-sm text-center ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {t.downloadingMessage}
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {status === "ready" && result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm font-medium text-green-800 mb-2">
                {result.title}
              </p>
              <button
                onClick={handleFileDownload}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                {t.saveFileButton}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
