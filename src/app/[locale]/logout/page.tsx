import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { safeInternalPath } from "@/lib/redirects";
import { revokeUniversalAppSessionsForUser } from "@/lib/universal-apps/runtime-session";
import { getTranslations } from "next-intl/server";

export default async function LogoutPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; returnTo?: string }>;
}) {
  const query = await searchParams;
  const callbackUrl = safeInternalPath(query.callbackUrl || query.returnTo, "/");
  const t = await getTranslations("logout");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <img src="/appai-logo2.png" alt="AppAI" className="mx-auto mb-4 h-14 w-14 rounded-xl" />
        <h1 className="text-2xl font-bold text-gray-950">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("description")}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link href={callbackUrl} className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">{t("cancel")}</Link>
          <form action={async () => {
            "use server";
            const session = await auth();
            if (session?.user?.id) await revokeUniversalAppSessionsForUser(session.user.id);
            await signOut({ redirectTo: callbackUrl });
          }}>
            <button type="submit" className="w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800">{t("confirm")}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
