import Link from "next/link";

type AccountLabels = {
  signIn: string;
  dashboard: string;
  signOut: string;
  account: string;
};

type AccountUser = {
  name?: string | null;
  email?: string | null;
};

/** Server-rendered account controls. No Organization identifiers are exposed. */
export function AccountControls({
  user,
  callbackUrl = "/dashboard",
  labels,
  light = false,
}: {
  user?: AccountUser | null;
  callbackUrl?: string;
  labels: AccountLabels;
  light?: boolean;
}) {
  const displayName = user?.name || user?.email || labels.account;
  const muted = light ? "text-slate-500 hover:text-white" : "text-gray-600 hover:text-black";
  const surface = light ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-gray-950 hover:bg-gray-800 text-white";

  if (!user) {
    return <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${surface}`}>{labels.signIn}</Link>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label={labels.account}>
      <span className={`max-w-20 truncate text-sm sm:max-w-28 ${light ? "text-slate-300" : "text-gray-700"}`} title={user.email || displayName}>{displayName}</span>
      <Link href="/dashboard" className={`hidden text-sm transition-colors sm:inline ${muted}`}>{labels.dashboard}</Link>
      <Link href="/logout?callbackUrl=/" className={`text-sm transition-colors ${muted}`}>{labels.signOut}</Link>
    </div>
  );
}
