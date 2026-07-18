import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireOrganizationContext } from "@/lib/organization-context";
import { ensureOrganizationApp } from "@/lib/native-apps/service";
import { NativeAppError } from "@/lib/native-apps/errors";
import { SIMPLESHOP_MODULES } from "@/lib/simpleshop/modules";
import { safeInternalPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Simpleshop 店務管理 - AppAI",
  description: "AppAI 原生店務管理系統",
};

export default async function SimpleshopLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const returnTo = safeInternalPath(
    requestHeaders.get("x-appai-request-path"),
    "/app/simpleshop",
  );
  let context;
  try {
    context = await requireOrganizationContext();
  } catch (error) {
    if (error instanceof NativeAppError && error.code === "UNAUTHENTICATED") {
      redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }

  const instance = await ensureOrganizationApp(context.organizationId, "simpleshop");
  if (instance.status !== "ACTIVE") {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-700 bg-amber-950/30 p-8">
          <h1 className="text-2xl font-bold">Simpleshop 已暫停</h1>
          <p className="mt-3 text-amber-100">此 Organization 的應用實例目前無法使用，請聯絡 AppAI 管理員。</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link href="/app/simpleshop" className="text-lg font-bold text-white">Simpleshop</Link>
            <p className="text-xs text-slate-500">{context.organization.name}</p>
          </div>
          <nav className="flex max-w-full gap-1 overflow-x-auto pb-1 text-sm">
            {Object.entries(SIMPLESHOP_MODULES).map(([key, module]) => (
              <Link key={key} href={`/app/simpleshop/${key}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white">
                {module.title}
              </Link>
            ))}
            <Link href="/app/simpleshop/settings" className="whitespace-nowrap rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white">設定</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
