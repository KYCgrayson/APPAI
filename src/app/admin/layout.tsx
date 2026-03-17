import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-black text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-xl font-bold flex items-center gap-2">
              <img src="/appai.png" alt="AppAI" className="w-7 h-7 rounded" />
              AppAI <span className="text-xs font-normal bg-white/20 px-2 py-0.5 rounded ml-1">Admin</span>
            </Link>
            <div className="flex gap-4">
              <Link href="/admin" className="text-sm text-gray-300 hover:text-white">
                Overview
              </Link>
              <Link href="/admin/apps" className="text-sm text-gray-300 hover:text-white">
                Apps
              </Link>
              <Link href="/admin/pages" className="text-sm text-gray-300 hover:text-white">
                Pages
              </Link>
              <Link href="/admin/users" className="text-sm text-gray-300 hover:text-white">
                Users
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{admin.email}</span>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
              Dashboard
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white">
              Site
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="text-sm text-gray-400 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
