"use client";

import { useState } from "react";

type Format = "video" | "mp3";
type VideoQuality = "2160" | "1080" | "720" | "480";
type Mp3Quality = "320" | "192" | "128";

export default function ToolsPage() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video");
  const [videoQuality, setVideoQuality] = useState<VideoQuality>("1080");
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

  const API_BASE = process.env.NEXT_PUBLIC_YTDLP_API_URL || "";
  const API_TOKEN = process.env.NEXT_PUBLIC_YTDLP_API_TOKEN || "";

  const handleDownload = async () => {
    if (!url.trim()) return;

    setStatus("downloading");
    setError("");
    setResult(null);

    const params = new URLSearchParams({
      url: url.trim(),
      format,
      quality: format === "video" ? videoQuality : mp3Quality,
      subtitles: subtitles ? "true" : "false",
    });

    try {
      const res = await fetch(`${API_BASE}/download?${params}`, {
        method: "POST",
        headers: { token: API_TOKEN },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Download failed");
      }

      const data = await res.json();
      setResult(data);
      setStatus("ready");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      setStatus("error");
    }
  };

  const handleFileDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `${API_BASE}/file/${result.file_id}?token=${API_TOKEN}`;
    link.download = result.title || result.file_id;
    link.click();
  };

  const toggleClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? "bg-black text-white border-black"
        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
    }`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-bold mb-8">Media Helper</h1>

      <div className="w-full max-w-xl space-y-5">
        {/* URL + Download */}
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL"
            className="flex-1 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
          />
          <button
            onClick={handleDownload}
            disabled={status === "downloading" || !url.trim()}
            className="bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "downloading" ? "Processing..." : "Download"}
          </button>
        </div>

        {/* Settings */}
        <div className="border rounded-xl p-4 space-y-4">
          {/* Format */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Format</span>
            <div className="flex gap-2">
              <button onClick={() => setFormat("video")} className={toggleClass(format === "video")}>
                Video
              </button>
              <button onClick={() => setFormat("mp3")} className={toggleClass(format === "mp3")}>
                MP3
              </button>
            </div>
          </div>

          {/* Quality */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Quality</span>
            <div className="flex gap-2">
              {format === "video" ? (
                <>
                  {(["4K", "1080p", "720p", "480p"] as const).map((label) => {
                    const val = label === "4K" ? "2160" : label.replace("p", "");
                    return (
                      <button
                        key={val}
                        onClick={() => setVideoQuality(val as VideoQuality)}
                        className={toggleClass(videoQuality === val)}
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
                    >
                      {val} kbps
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Subtitles (video only) */}
          {format === "video" && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Subtitles</span>
              <button
                onClick={() => setSubtitles(!subtitles)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  subtitles ? "bg-black" : "bg-gray-300"
                }`}
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

        {/* Status */}
        {status === "downloading" && (
          <p className="text-sm text-gray-500 text-center">
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
  );
}
