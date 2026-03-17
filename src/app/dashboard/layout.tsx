import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = (session as any).role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold flex items-center gap-2">
              <img src="/appai.png" alt="AppAI" className="w-7 h-7 rounded" />
              AppAI
            </Link>
            <div className="flex gap-4">
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
                href="/dashboard/settings"
                className="text-sm text-gray-600 hover:text-black"
              >
                API Keys
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-black"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
