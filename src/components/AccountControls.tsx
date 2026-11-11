import Link from "next/link";

export type AccountLabels = {
  signIn: string;
  dashboard: string;
  signOut: string;
  account: string;
};

export type AccountUser = {
  name?: string | null;
  email?: string | null;
};

/** Server-rendered account controls. No Organization identifiers are exposed. */
export function AccountControls({
  user,
  callbackUrl = "/dashboard",
  labels,
  light = false,
  isAdmin = false,
  compact = false,
}: {
  user?: AccountUser | null;
  callbackUrl?: string;
  labels: AccountLabels;
  light?: boolean;
  /** Marks the signed-in name with an ADMIN pill. Admin accounts get
   *  different limits (uncapped clip length, no daily quota), and there was
   *  no way to tell which account you were signed in as. */
  isAdmin?: boolean;
  /** Constrain the game-header row and enlarge its controls without changing default layouts. */
  compact?: boolean;
}) {
  const displayName = user?.name || user?.email || labels.account;
  const muted = light ? "text-slate-500 hover:text-white" : "text-gray-600 hover:text-black";
  const surface = light ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-gray-950 hover:bg-gray-800 text-white";
  const tapTarget = compact ? "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap" : "";

  if (!user) {
    return <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={`${tapTarget} rounded-lg px-3 py-2 text-sm font-medium transition-colors ${surface}`}>{labels.signIn}</Link>;
  }

  return (
    <div className={`flex min-w-0 items-center ${compact ? "gap-1.5" : "gap-2"} sm:gap-3`} aria-label={labels.account}>
      {isAdmin && (
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            light
              ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
              : "border-amber-300 bg-amber-50 text-amber-700"
          }`}
        >
          ★ Admin
        </span>
      )}
      <span className={`min-w-0 max-w-20 truncate text-sm sm:max-w-28 ${light ? "text-slate-300" : "text-gray-700"}`} title={user.email || displayName}>{displayName}</span>
      <Link href="/dashboard" className={`${compact ? "hidden min-h-11 shrink-0 items-center whitespace-nowrap sm:inline-flex" : "hidden sm:inline"} text-sm transition-colors ${muted}`}>{labels.dashboard}</Link>
      <Link href="/logout?callbackUrl=/" className={`${tapTarget} text-sm transition-colors ${muted}`}>{labels.signOut}</Link>
    </div>
  );
}
