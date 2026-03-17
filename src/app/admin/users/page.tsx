export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { AdminUserActions } from "./actions";

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: {
        select: {
          name: true,
          plan: true,
          _count: { select: { pages: true, apps: true, apiKeys: true } },
        },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <span className="text-sm text-gray-500">{users.length} users</span>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {user.image ? (
                  <img src={user.image} alt={user.name || ""} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                    {(user.name || user.email || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{user.name || "—"}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.role === "ADMIN"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {user.organization ? (
                      <>
                        Org: {user.organization.name} ({user.organization.plan})
                        {" · "}
                        {user.organization._count.pages} pages, {user.organization._count.apps} apps, {user.organization._count.apiKeys} keys
                      </>
                    ) : (
                      "No organization"
                    )}
                    {" · "}Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <AdminUserActions userId={user.id} role={user.role} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
