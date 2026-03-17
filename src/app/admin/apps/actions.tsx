"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminAppActions({
  appId,
  isApproved,
  isFeatured,
}: {
  appId: string;
  isApproved: boolean;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string) {
    setLoading(true);
    await fetch("/api/admin/apps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, action }),
    });
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this app? This cannot be undone.")) return;
    setLoading(true);
    await fetch("/api/admin/apps", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!isApproved ? (
        <button
          onClick={() => handleAction("approve")}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
      ) : (
        <button
          onClick={() => handleAction("unapprove")}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50"
        >
          Unapprove
        </button>
      )}
      {isApproved && (
        <button
          onClick={() => handleAction(isFeatured ? "unfeature" : "feature")}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
            isFeatured
              ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
        >
          {isFeatured ? "Unfeature" : "Feature"}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
