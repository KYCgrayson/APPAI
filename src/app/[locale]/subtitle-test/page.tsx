import { notFound } from "next/navigation";
import { VideoSubtitleSection } from "@/templates/sections/VideoSubtitleSection";

// DEV-ONLY test harness. Mounts the video-subtitle UI directly against a local
// backend, bypassing the CMS/DB. Safe to delete. Run the backend (my-tools
// services/video-subtitle: ./scripts/dev.sh) then open
// http://localhost:3000/subtitle-test
//
// Gated: on real deployments (Vercel — ALLOW_LOCAL_HTTP_BACKEND unset) this
// page 404s. The production page is created via the CMS with
// apiBase="/api/subtitle" (the login-gated proxy).
export default function SubtitleTestPage() {
  if (process.env.ALLOW_LOCAL_HTTP_BACKEND !== "1") notFound();
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <VideoSubtitleSection
        themeColor="#2563eb"
        data={{
          heading: "YouTube Subtitle Studio (dev test)",
          description: "Paste a YouTube URL → trim ≤10 min → transcribe → edit → render.",
          apiBase: "http://localhost:8000/v1",
          maxDurationSec: 600,
          supportedLanguages: ["en", "ja", "ko", "zh-Hans", "zh-Hant"],
        }}
      />
    </main>
  );
}
