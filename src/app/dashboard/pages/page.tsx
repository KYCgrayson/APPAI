import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardPagesHref, loadDashboardPages, pageFilters, pagePresentation, type PageSearch } from "@/lib/dashboard-pages";
import Link from "next/link";

export default async function PagesListPage({ searchParams }: { searchParams: Promise<PageSearch> }) {
  const session = await auth();
  const filters = pageFilters(await searchParams);
  const result = session?.organizationId
    ? await loadDashboardPages(db, session.organizationId, filters)
    : { groups: [], roots: [], nextCursor: null };
  const period = filters.created === "all" ? "Created at any time" : `Created in the last ${Number.parseInt(filters.created)} days`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Your Pages</h1>
      <p className="text-gray-600 mb-6">{period} · UTC · One row per page across all locales.</p>
      <form action="/dashboard/pages" className="mb-8 flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-sm">Search
          <input name="q" defaultValue={filters.q} placeholder="Title or slug" className="rounded-lg border bg-white p-2" />
        </label>
        <label className="grid gap-1 text-sm">Created
          <select name="created" defaultValue={filters.created} className="rounded-lg border bg-white p-2">
            <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option><option value="all">All time</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Status
          <select name="status" defaultValue={filters.status} className="rounded-lg border bg-white p-2">
            <option value="">All statuses</option><option value="published">Published</option><option value="unpublished">Unpublished</option>
          </select>
        </label>
        <button className="rounded-lg bg-black px-4 py-2 text-white">Filter</button>
      </form>
      {result.groups.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No matching pages</h2>
          <p className="text-gray-600 mb-4">Change the filters, or use your AI Agent with an API key to create a page.</p>
          <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Get API Key</Link>
        </div>
      ) : <div className="space-y-6">
        {result.groups.map(group => <section key={group.slug} className="overflow-hidden rounded-xl bg-white shadow-sm">
          <h2 className="border-b bg-gray-50 px-6 py-4 font-semibold">{group.title} <span className="font-normal text-gray-500">{group.slug}{group.continued ? " · continued" : ""}</span></h2>
          <div className="divide-y">{[...group.pages].sort((a, b) => Number(!!a.parentSlug) - Number(!!b.parentSlug)).map(page => {
            const variant = page.variants[0];
            const presentations = page.variants.map(row => ({ row, ...pagePresentation(row, result.roots) }));
            const statuses = [...new Set(presentations.map(item => item.status))];
            return <article key={page.id} className={`p-6 ${page.parentSlug ? "sm:pl-10" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold">{variant?.title || page.slug}</h3>
                {statuses.length === 1 && <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{statuses[0]}</span>}
                <span className="text-xs text-gray-500">{variant?.template}</span>
              </div>
              <p className="mt-1 break-all text-sm text-gray-500">{page.parentSlug ? `${page.parentSlug} / ` : ""}{page.slug} · Created {page.createdAt.toISOString().slice(0, 10)}</p>
              <ul className="mt-3 flex flex-wrap gap-3" aria-label="Locales">
                {presentations.map(item => <li key={item.row.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <span>{item.row.locale}{item.row.isDefault ? " · default" : ""}{statuses.length > 1 ? ` · ${item.status}` : ""}</span>
                  {([['View', item.view], ['Privacy', item.privacy], ['Terms', item.terms]] as const).map(([label, href]) => href &&
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{label}</a>)}
                </li>)}
              </ul>
            </article>;
          })}</div>
        </section>)}
      </div>}
      <nav className="mt-6 flex gap-4" aria-label="Page navigation">
        {filters.cursor && <Link href={dashboardPagesHref(filters)} className="text-blue-600 hover:underline">First page</Link>}
        {result.nextCursor && <Link href={dashboardPagesHref(filters, result.nextCursor)} className="text-blue-600 hover:underline">Next page</Link>}
      </nav>
    </div>
  );
}
