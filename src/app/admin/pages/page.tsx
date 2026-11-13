import { PageActions } from "@/app/dashboard/pages/actions";
import { db } from "@/lib/db";
import { pagePresentation, logicalPageStatus, PAGE_STATUS_LABELS, type PageSummary } from "@/lib/dashboard-pages";
import { logicalKey } from "@/lib/page-management";
import { AdminPageActions } from "./actions";
export const dynamic = "force-dynamic";

export default async function AdminPagesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const rows = await db.hostedPage.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true, organizationId: true, parentSlug: true, slug: true, title: true, template: true,
      locale: true, isDefault: true, isPublished: true, createdAt: true, removalState: true,
      removalSource: true, removedAt: true, removedById: true, organization: { select: { name: true } } },
  });
  const summaries = rows.map(row => ({ ...row, hasPrivacy: false, hasTerms: false }));
  const roots = summaries.filter(row => !row.parentSlug);
  const groups = new Map<string, typeof summaries>();
  for (const row of summaries) groups.set(logicalKey(row), [...(groups.get(logicalKey(row)) || []), row]);
  const pages = [...groups.values()].filter(variants => !filter || logicalPageStatus(variants, roots) === filter);
  const userIds = [...new Set(rows.flatMap(row => row.removedById ? [row.removedById] : []))];
  const [users, events] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    rows.length ? db.hostedPageEvent.findMany({ where: { pageId: { in: rows.map(row => row.id) }, action: "agent_blocked" },
      distinct: ["pageId"], orderBy: { createdAt: "desc" }, select: { pageId: true, createdAt: true } }) : [],
  ]);
  const filters = [["All", ""], ...Object.entries(PAGE_STATUS_LABELS).map(([value, label]) => [label, value])];
  return <div>
    <h1 className="mb-4 text-2xl font-bold">Manage Pages <span className="text-sm font-normal text-gray-500">{pages.length} logical pages</span></h1>
    <nav className="mb-6 flex flex-wrap gap-3" aria-label="Page status">{filters.map(([label, value]) =>
      <a key={value} href={value ? `/admin/pages?filter=${value}` : "/admin/pages"} className={`rounded-full px-3 py-1 text-sm ${filter === value ? "bg-black text-white" : "bg-gray-100"}`}>{label}</a>)}</nav>
    <PageActions endpoint="/api/admin/pages"><div className="space-y-3">
      {pages.map(variants => {
        const page = variants[0];
        const blocked = events.filter(event => variants.some(row => row.id === event.pageId)).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return <article key={logicalKey(page)} className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3"><input type="checkbox" name="targets" value={page.id} aria-label={`Select ${page.title}`} />
            <h2 className="font-semibold">{page.title}</h2><span className="text-sm text-gray-500">{page.organization.name} · {page.parentSlug ? `${page.parentSlug} / ` : ""}{page.slug}</span>
            <AdminPageActions pageId={page.id} slug={page.slug} isPublished={page.isPublished} /></div>
          <ul className="mt-3 flex flex-wrap gap-3">{variants.map(row => {
            const presentation = pagePresentation(row as PageSummary, roots);
            return <li key={row.id} className="rounded border p-2 text-xs">{row.locale}{row.isDefault ? " · default" : ""} · {presentation.status}
              {presentation.view && <a className="ml-2 text-blue-600" href={presentation.view} target="_blank" rel="noopener noreferrer">View</a>}</li>;
          })}</ul>
          {page.removedAt && <p className="mt-2 text-sm">Removed by {page.removalSource === "ADMIN" ? "Admin" : users.find(user => user.id === page.removedById)?.name || "owner"} on {page.removedAt.toISOString().slice(0,10)}</p>}
          {blocked && <p className="text-sm">Agent tried to republish · last {blocked.createdAt.toISOString()}</p>}
        </article>;
      })}
      {pages.length === 0 && <p>No matching pages.</p>}
    </div></PageActions>
  </div>;
}
