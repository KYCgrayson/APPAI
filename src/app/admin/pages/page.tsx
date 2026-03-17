export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { AdminPageActions } from "./actions";

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const where = filter === "published"
    ? { isPublished: true }
    : filter === "draft"
    ? { isPublished: false }
    : {};

  const pages = await db.hostedPage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true, email: true } } },
  });

  const filters = [
    { label: "All", value: "" },
    { label: "Published", value: "published" },
    { label: "Draft", value: "draft" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Pages</h1>
        <span className="text-sm text-gray-500">{pages.length} pages</span>
      </div>

      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <a
            key={f.value}
            href={f.value ? `/admin/pages?filter=${f.value}` : "/admin/pages"}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              (filter || "") === f.value
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {pages.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">No pages found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{page.title}</span>
                    <span className="text-xs text-gray-400">{page.template}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      page.isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {page.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">{page.tagline}</p>
                  <div className="text-xs text-gray-400 mt-1">
                    by {page.organization.name}
                    {" · "}
                    <a href={`/p/${page.slug}`} target="_blank" className="text-blue-500 hover:underline">/p/{page.slug}</a>
                    {" · "}{new Date(page.createdAt).toLocaleDateString()}
                    {page.themeColor && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: page.themeColor }} />
                        {page.themeColor}
                      </span>
                    )}
                  </div>
                </div>
                <AdminPageActions
                  pageId={page.id}
                  slug={page.slug}
                  isPublished={page.isPublished}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
