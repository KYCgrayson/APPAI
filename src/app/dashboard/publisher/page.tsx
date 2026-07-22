import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PublisherReleaseForm } from "@/components/publisher/PublisherReleaseForm";

export const dynamic = "force-dynamic";

const statusClasses: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  RETIRED: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PROVISIONING: "bg-blue-100 text-blue-800",
};

function Status({ label, value }: { label: string; value: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[value] ?? "bg-gray-100 text-gray-700"}`}>{label}: {value}</span>;
}

export default async function PublisherPage() {
  const session = await auth();
  const organizationId = session?.organizationId;
  if (!organizationId) return <div className="py-20 text-center text-gray-600">Your organization is being set up. Please refresh in a moment.</div>;

  const apps = await db.app.findMany({
    where: { organizationId, appType: { not: null } },
    select: {
      id: true, appType: true, name: true, tagline: true, category: true, isApproved: true,
      releases: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, version: true, status: true, sourceType: true, createdAt: true,
          deployments: { orderBy: { createdAt: "desc" }, select: { status: true, environment: true, updatedAt: true, managedRuntime: { select: { failureCode: true, failureMessage: true } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><h1 className="text-2xl font-bold">Publisher</h1><p className="mt-2 max-w-2xl text-gray-600">Publish a complete app from your own development workspace. AppAI owns the reviewed build, runtime, database, authentication, domain, and launch experience.</p></div>
      <a href="#publish" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Publish an app</a>
    </section>

    <section id="publish" className="scroll-mt-6 rounded-xl bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Publish an immutable release</h2>
      <div className="mt-4"><PublisherReleaseForm /></div>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link href="/dashboard/settings" className="text-blue-700 hover:underline">API Keys</Link><Link href="/llms.txt" className="text-blue-700 hover:underline">Agent publishing instructions</Link></div>
    </section>

    <section aria-labelledby="published-apps"><div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><div><h2 id="published-apps" className="text-lg font-semibold">Your Universal Apps</h2><p className="text-sm text-gray-600">Only your organization’s releases are shown here. Platform review remains in AppAI’s internal back office.</p></div><span className="text-sm text-gray-500">{apps.length} apps</span></div>
      {apps.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-gray-600 shadow-sm">No Universal Apps yet. Publish your first release above.</div> : <div className="space-y-4">{apps.map((app) => {
        const active = app.releases.some((release) => release.deployments.some((deployment) => deployment.environment === "PRODUCTION" && deployment.status === "ACTIVE"));
        return <article key={app.id} className="rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{app.name}</h3><p className="mt-1 text-sm text-gray-600">{app.appType} · {app.category} · {app.tagline}</p></div>{active && app.isApproved ? <Link href={`/app/${app.appType}`} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">Open app</Link> : <span className="text-sm text-gray-500">Not live yet</span>}</div>
          <div className="mt-4 space-y-3 border-t pt-4">{app.releases.map((release) => { const deployment = release.deployments[0]; const failure = deployment?.status === "FAILED" ? deployment.managedRuntime?.failureMessage || deployment.managedRuntime?.failureCode || "The platform deployment failed." : null; return <div key={release.id} className="rounded-lg bg-gray-50 p-3"><div className="flex flex-wrap items-center gap-2 text-sm"><strong>v{release.version}</strong><Status label="Review" value={release.status} /><Status label="Deployment" value={deployment?.status ?? "Not started"} /><span className="text-gray-500">{release.sourceType === "PACKAGE" ? "Package" : "Repository"} · <time dateTime={release.createdAt.toISOString()}>{release.createdAt.toLocaleString()}</time></span></div>{failure && <p className="mt-2 text-sm text-red-700">Deployment issue: {failure}</p>}</div>; })}</div>
        </article>;
      })}</div>}
    </section>
  </div>;
}
