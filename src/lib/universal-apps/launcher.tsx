import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NativeAppError } from "@/lib/native-apps/errors";
import { requireOrganizationContext } from "@/lib/organization-context";
import { getPlatformLocale } from "@/lib/platform-locale";
import { safeInternalPath } from "@/lib/redirects";
import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { createUniversalAppLaunch, UniversalAppRuntimeError } from "@/lib/universal-apps/runtime-session";

/**
 * Runtime failure codes a visitor can actually reach by opening `/app/{appId}`.
 * Anything else keeps the thrown English message, which is operational detail
 * rather than visitor-facing copy.
 */
const REASON_KEYS: Record<string, string> = {
  APP_UNAVAILABLE: "appUnavailable",
  INVALID_RELEASE: "invalidRelease",
  INVALID_DEPLOYMENT: "invalidDeployment",
  APP_SUSPENDED: "appSuspended",
};

export async function launchUniversalApp(appId: string, returnPath: string) {
  const parsedAppId = universalAppIdSchema.safeParse(appId);
  if (!parsedAppId.success) return <Unavailable reasonKey="notFound" />;
  const safeReturnPath = safeInternalPath(returnPath, `/app/${parsedAppId.data}`);
  let context;
  try {
    context = await requireOrganizationContext();
  } catch (error) {
    if (error instanceof NativeAppError && error.code === "UNAUTHENTICATED") {
      redirect(`/login?callbackUrl=${encodeURIComponent(safeReturnPath)}`);
    }
    throw error;
  }

  try {
    const launch = await createUniversalAppLaunch({
      appId: parsedAppId.data,
      organizationId: context.organizationId,
      userId: context.userId,
      returnPath: safeReturnPath,
    });
    redirect(launch.callbackUrl);
  } catch (error) {
    if (error instanceof UniversalAppRuntimeError) {
      return <Unavailable reasonKey={REASON_KEYS[error.code]} fallbackMessage={error.message} />;
    }
    throw error;
  }
}

/**
 * The URL stays locale-free so each app has one stable address, but the page a
 * visitor reads follows their language — resolved from the locale they were
 * already browsing in (see `getPlatformLocale`).
 */
async function Unavailable({
  reasonKey,
  fallbackMessage,
}: {
  reasonKey?: string;
  fallbackMessage?: string;
}) {
  const locale = await getPlatformLocale();
  const t = await getTranslations({ locale, namespace: "universalRuntime" });
  const message = reasonKey ? t(reasonKey) : fallbackMessage || t("appUnavailable");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100" lang={locale}>
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">AppAI Universal Runtime</p>
        <h1 className="mt-3 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-slate-400">{message}</p>
      </div>
    </main>
  );
}
