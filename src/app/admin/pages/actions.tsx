"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminPageActions({
  pageId,
  slug,
  isPublished,
}: {
  pageId: string;
  slug: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string) {
    setLoading(true);
    await fetch("/api/admin/pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, action }),
    });
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete page /p/${slug}? This will also remove the linked app listing.`)) return;
    setLoading(true);
    await fetch("/api/admin/pages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, slug }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <a
        href={`/p/${slug}`}
        target="_blank"
        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
      >
        View
      </a>
      <button
        onClick={() => handleAction(isPublished ? "unpublish" : "publish")}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 ${
          isPublished
            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {isPublished ? "Unpublish" : "Publish"}
      </button>
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
