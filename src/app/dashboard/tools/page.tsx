"use client";

import { useState } from "react";

export default function ToolsPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "downloading" | "ready" | "error">("idle");
  const [result, setResult] = useState<{ file_id: string; title: string } | null>(null);
  const [error, setError] = useState("");

  // TODO: 之後換成 Cloudflare Tunnel 的外網網址
  const API_BASE = process.env.NEXT_PUBLIC_YTDLP_API_URL || "http://192.168.200.108:8000";
  const API_TOKEN = process.env.NEXT_PUBLIC_YTDLP_API_TOKEN || "";

  const handleDownload = async () => {
    if (!url.trim()) return;

    setStatus("downloading");
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/download?url=${encodeURIComponent(url)}`, {
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
    } catch (e: any) {
      setError(e.message || "Something went wrong");
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Media Helper</h1>

      <div className="bg-white rounded-lg border p-6 max-w-2xl">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste a video URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
          />
          <button
            onClick={handleDownload}
            disabled={status === "downloading" || !url.trim()}
            className="bg-black text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "downloading" ? "Processing..." : "Download"}
          </button>
        </div>

        {status === "downloading" && (
          <p className="mt-4 text-sm text-gray-500">
            Downloading and processing video, please wait...
          </p>
        )}

        {status === "error" && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        {status === "ready" && result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">{result.title}</p>
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
