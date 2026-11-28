import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { VideoAskSection } from "@/templates/sections/VideoAskSection";

/**
 * DEV ONLY preview of the video-ask section against the mock backend at
 * /api/dev/video-ask-mock. No database needed. 404s in production builds.
 *
 *   /dev/video-ask?mode=floating|inline&backend=ok|down|nostats|malformed|local&dark=1&custom=1
 *   backend=local → /api/dev/video-ask-local → my-tools services/video-ask/serve.py on this machine
 *   /zh-TW/dev/video-ask?...  (any platform locale)
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { robots: { index: false, follow: false } };

export default async function VideoAskPreview({ params, searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const one = (key: string) => (Array.isArray(query[key]) ? query[key]?.[0] : query[key]) as string | undefined;
  const mode = one("mode") === "inline" ? "inline" : "floating";
  const backend = ["down", "nostats", "malformed"].includes(one("backend") ?? "") ? `/${one("backend")}` : "";
  const dark = one("dark") === "1";
  const themeColor = "#d9467a";

  return (
    <main className={`min-h-screen ${dark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
        <p className="text-xs font-mono uppercase tracking-wide opacity-60">Dev preview · video-ask · {one("backend") === "local" ? "LOCAL REAL INDEX" : `mock backend${backend || "/ok"}`}</p>
        <h1 className="text-3xl font-bold">GTA 6 fan guide (fake demo page)</h1>
        <p className="opacity-80">This stands in for a hosted page. The rest of the page keeps working whatever the video backend does.</p>
      </div>
      <VideoAskSection
        data={{
          heading: "Ask the GTA 6 video index",
          intro: "Ask anything about the trailers, map or release. Answers are videos from creators.",
          mode,
          // Same-origin mock; published pages must use connector or an https backendUrl.
          backendUrl: one("backend") === "local" ? "/api/dev/video-ask-local" : `/api/dev/video-ask-mock${backend}`,
          allowCustomBackend: one("custom") !== "0",
          disclaimer: "Videos belong to their creators. Fan project, not affiliated with Rockstar Games.",
        }}
        themeColor={themeColor}
        darkMode={dark}
        locale={locale}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-3 opacity-70">
        {Array.from({ length: 6 }, (_, i) => (
          <p key={i}>Placeholder page content paragraph {i + 1}. Lorem ipsum stands in for the rest of a hosted page.</p>
        ))}
      </div>
    </main>
  );
}
