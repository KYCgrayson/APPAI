import { redirect } from "next/navigation";

import { NativeAppError } from "@/lib/native-apps/errors";
import { requireOrganizationContext } from "@/lib/organization-context";
import { safeInternalPath } from "@/lib/redirects";
import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { createUniversalAppLaunch, UniversalAppRuntimeError } from "@/lib/universal-apps/runtime-session";

export async function launchUniversalApp(appId: string, returnPath: string) {
  const parsedAppId = universalAppIdSchema.safeParse(appId);
  if (!parsedAppId.success) return <Unavailable message="找不到這個應用程式。" />;
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
    if (error instanceof UniversalAppRuntimeError) return <Unavailable message={error.message} />;
    throw error;
  }
}

function Unavailable({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">AppAI Universal Runtime</p>
        <h1 className="mt-3 text-2xl font-bold">應用程式尚未可用</h1>
        <p className="mt-3 text-slate-400">{message}</p>
      </div>
    </main>
  );
}
