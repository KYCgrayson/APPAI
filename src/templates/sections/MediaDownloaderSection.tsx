"use client";

import { useState } from "react";

type Format = "video" | "mp3";
type VideoQuality = "2160" | "1080" | "720" | "480";
type Mp3Quality = "320" | "192" | "128";

interface Props {
  data: {
    heading?: string;
    description?: string;
    apiBase: string;
    apiToken?: string;
    maxVideoQuality?: VideoQuality;
    /** Page slug, injected by PageRenderer for proxy mode */
    _pageSlug?: string;
  };
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

export function MediaDownloaderSection({ data, themeColor, darkMode }: Props) {
  const maxVideo = Number(data.maxVideoQuality ?? "2160");
  const defaultVideoQuality: VideoQuality =
    720 <= maxVideo ? "720" : 480 <= maxVideo ? "480" : (data.maxVideoQuality ?? "480");

  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video");
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(defaultVideoQuality);
  const [mp3Quality, setMp3Quality] = useState<Mp3Quality>("320");
  const [subtitles, setSubtitles] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "downloading" | "ready" | "error"
  >("idle");
  const [result, setResult] = useState<{
    file_id: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState("");

  const useProxy = !!data._pageSlug;

  const handleDownload = async () => {
    if (!url.trim()) return;

    setStatus("downloading");
    setError("");
    setResult(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      let res: Response;

      if (useProxy) {
        const params = new URLSearchParams({
          slug: data._pageSlug!,
          action: "download",
          url: url.trim(),
          format,
          quality: format === "video" ? videoQuality : mp3Quality,
          subtitles: subtitles ? "true" : "false",
        });
        res = await fetch(`/api/v1/media-proxy?${params}`, {
          method: "POST",
          signal: controller.signal,
        });
      } else {
        const params = new URLSearchParams({
          url: url.trim(),
          format,
          quality: format === "video" ? videoQuality : mp3Quality,
          subtitles: subtitles ? "true" : "false",
        });
        res = await fetch(`${data.apiBase}/download?${params}`, {
          method: "POST",
          headers: data.apiToken ? { token: data.apiToken } : {},
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).detail || (body as Record<string, string>).error || "Download failed",
        );
      }

      const body = await res.json();
      setResult(body);
      setStatus("ready");
    } catch (e: unknown) {
      let message = "Something went wrong";
      if (e instanceof DOMException && e.name === "AbortError") {
        message = "Request timed out. The server took too long to respond.";
      } else if (e instanceof Error) {
        message = e.message;
      }
      setError(message);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleFileDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    if (useProxy) {
      const params = new URLSearchParams({
        slug: data._pageSlug!,
        action: "file",
        fileId: result.file_id,
      });
      link.href = `/api/v1/media-proxy?${params}`;
    } else {
      link.href = `${data.apiBase}/file/${result.file_id}${data.apiToken ? `?token=${data.apiToken}` : ""}`;
    }
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
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL"
              className={`w-full sm:flex-1 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                darkMode ? "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500" : ""
              }`}
              style={
                { "--tw-ring-color": themeColor } as React.CSSProperties
              }
              onKeyDown={(e) => e.key === "Enter" && handleDownload()}
            />
            <button
              onClick={handleDownload}
              disabled={status === "downloading" || !url.trim()}
              className="text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: themeColor }}
            >
              {status === "downloading" ? "Processing..." : "Download"}
            </button>
          </div>

          <div className={`border rounded-xl p-4 space-y-4 ${darkMode ? "border-gray-700" : ""}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                Format
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
                  Video
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
                  MP3
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                Quality
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
                  Subtitles
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

          {status === "downloading" && (
            <p className={`text-sm text-center ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Downloading and processing, please wait...
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
                Save File
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
