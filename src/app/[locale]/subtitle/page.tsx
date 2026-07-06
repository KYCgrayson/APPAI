import { auth, signIn } from "@/lib/auth";
import { VideoSubtitleSection } from "@/templates/sections/VideoSubtitleSection";

// Public production page for the YouTube Subtitle Studio.
// Login-gated: the tool calls /api/subtitle (a login-checked proxy), so an
// anonymous visitor sees a sign-in prompt; a signed-in visitor gets the tool.
// apiBase points at the same-origin proxy — never the backend directly.
export const dynamic = "force-dynamic";

export default async function SubtitlePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">YouTube Subtitle Studio</h1>
          <p className="text-gray-600 mb-8">
            Paste a YouTube link, trim a clip, auto-transcribe and translate,
            style the subtitles, and download a burned-in video. Sign in to
            start.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/subtitle" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-6 py-4 font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </form>
          <p className="mt-6 text-sm text-gray-400">
            Free · 1 video per day per account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <VideoSubtitleSection
        themeColor="#2563eb"
        data={{
          heading: "YouTube Subtitle Studio",
          description:
            "Paste a YouTube URL → trim ≤10 min → transcribe → edit → render.",
          apiBase: "/api/subtitle",
          maxDurationSec: 600,
          supportedLanguages: ["en", "ja", "ko", "zh-Hans", "zh-Hant"],
        }}
      />
    </main>
  );
}
