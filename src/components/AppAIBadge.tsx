import Link from "next/link";

/**
 * A small persistent AppAI marker for surfaces that carry no site chrome.
 *
 * The publisher owns the header on a hosted page — that is the whole point of
 * hosting someone's tool here — so the way back to AppAI cannot live there. On
 * a normal hosted page the footer link is enough. The fullscreen iframe-tool
 * view has neither header nor footer, which leaves a visitor with no route back
 * to the directory and no way to see whether they are signed in. This badge
 * fills exactly that gap and nothing else.
 *
 * Deliberately bottom-left: bottom-right is where tools tend to put their own
 * floating controls, and the iframe is a third party's UI we do not control.
 */
export function AppAIBadge({
  signedIn,
  dark = false,
  labels,
}: {
  signedIn: boolean;
  dark?: boolean;
  labels: { browse: string; signIn: string; signedIn: string };
}) {
  const surface = dark
    ? "bg-slate-900/85 border-slate-700 text-slate-200 hover:bg-slate-800"
    : "bg-white/85 border-gray-200 text-gray-700 hover:bg-white";

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
      <Link
        href="/apps"
        title={labels.browse}
        className={`flex items-center gap-2 rounded-full border ${surface} px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/appai-logo2.png" alt="" aria-hidden className="h-4 w-4 rounded" />
        <span>AppAI</span>
        <span aria-hidden className={dark ? "text-slate-600" : "text-gray-300"}>
          |
        </span>
        <span className={dark ? "text-slate-400" : "text-gray-500"}>{labels.browse}</span>
      </Link>

      {/* Account state travels with the badge, since a login-gated tool inside
          the iframe otherwise gives the visitor no signal about who they are. */}
      {signedIn ? (
        <span
          title={labels.signedIn}
          className={`flex items-center gap-1.5 rounded-full border ${surface} px-3 py-1.5 text-xs shadow-lg backdrop-blur`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          {labels.signedIn}
        </span>
      ) : (
        <Link
          href="/login"
          className={`rounded-full border ${surface} px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors`}
        >
          {labels.signIn}
        </Link>
      )}
    </div>
  );
}
