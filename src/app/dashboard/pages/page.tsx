import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PagesListPage() {
  const session = await auth();
  const orgId = (session as any)?.organizationId;

  const pages = orgId
    ? await db.hostedPage.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Your Pages</h1>
      </div>

      {pages.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No pages yet</h2>
          <p className="text-gray-600 mb-4">
            Use your AI Agent with an API key to create your first page.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Get API Key
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{page.title}</h2>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      page.isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {page.isPublished ? "Published" : "Draft"}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {page.template}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  /p/{page.slug}
                  {page.tagline && ` — ${page.tagline}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {page.isPublished && (
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View
                  </a>
                )}
                {page.privacyPolicy && (
                  <a
                    href={`/p/${page.slug}/privacy`}
                    target="_blank"
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Privacy
                  </a>
                )}
                {page.termsOfService && (
                  <a
                    href={`/p/${page.slug}/terms`}
                    target="_blank"
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Terms
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
