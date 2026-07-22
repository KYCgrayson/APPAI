import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-8">
            <Link href="/" className="text-xl font-bold flex items-center gap-2">
              <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
              AppAI
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-black"
              >
                Overview
              </Link>
              <Link
                href="/dashboard/pages"
                className="text-sm text-gray-600 hover:text-black"
              >
                Pages
              </Link>
              <Link
                href="/dashboard/publisher"
                className="text-sm text-gray-600 hover:text-black"
              >
                Publisher
              </Link>
              <Link
                href="/dashboard/settings"
                className="text-sm text-gray-600 hover:text-black"
              >
                API Keys
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href="/dashboard/tools"
                    className="text-sm text-gray-600 hover:text-black"
                  >
                    Tools
                  </Link>
                  <Link
                    href="/admin"
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Admin
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="max-w-40 truncate text-sm text-gray-600 sm:max-w-64" title={session.user?.email ?? undefined}>
              {session.user?.email}
            </span>
            <Link href="/logout?callbackUrl=/" className="text-sm text-gray-500 hover:text-black">Sign out</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
