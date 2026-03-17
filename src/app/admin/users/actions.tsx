"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminUserActions({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggleRole() {
    const newRole = role === "ADMIN" ? "USER" : "ADMIN";
    if (role === "ADMIN" && !confirm("Remove admin privileges from this user?")) return;
    setLoading(true);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={handleToggleRole}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
          role === "ADMIN"
            ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {role === "ADMIN" ? "Remove Admin" : "Make Admin"}
      </button>
    </div>
  );
}
