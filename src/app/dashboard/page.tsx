import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const orgId = session?.organizationId;

  if (!orgId) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Setting up your account...</h1>
        <p className="text-gray-600">Please refresh the page in a moment.</p>
      </div>
    );
  }

  const [org, pageCount, appCount, keyCount] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId } }),
    db.hostedPage.count({ where: { organizationId: orgId } }),
    db.app.count({ where: { organizationId: orgId } }),
    db.apiKey.count({ where: { organizationId: orgId, isActive: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Organization: <span className="font-medium">{org?.name}</span>{" "}
        <span className="text-sm text-gray-400">({org?.plan} plan)</span>
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold">{pageCount}</div>
          <div className="text-gray-500">Hosted Pages</div>
          <div className="text-xs text-gray-400 mt-1">
            {org?.plan === "FREE" ? `${pageCount}/3 used` : "Unlimited"}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold">{appCount}</div>
          <div className="text-gray-500">Universal Apps</div>
          <div className="text-xs text-gray-400 mt-1">
            {org?.plan === "FREE" ? `${appCount}/1 used` : "Unlimited"}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold">{keyCount}</div>
          <div className="text-gray-500">Active API Keys</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Hosted Pages</h2>
          <p className="mb-4 text-sm text-gray-600">Use this for marketing sites, documentation, forms, and public landing pages.</p>
          <ol className="space-y-2 text-sm text-gray-600">
            <li>1. <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Generate an API Key</Link>.</li>
            <li>2. Give it to your AI Agent.</li>
            <li>3. Ask it to publish a landing page; it will be live at <code className="rounded bg-gray-100 px-1 py-0.5">/p/your-slug</code>.</li>
          </ol>
        </section>
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Universal Apps</h2>
          <p className="mb-4 text-sm text-gray-600">Use this for a complete application with its own UI, workflows, database, or private assets.</p>
          <ol className="space-y-2 text-sm text-gray-600">
            <li>1. Build and test the app in its own workspace.</li>
            <li>2. Add <code className="rounded bg-gray-100 px-1 py-0.5">appai.app.json</code> and create a source-only immutable package.</li>
            <li>3. <Link href="/dashboard/publisher" className="text-blue-600 hover:underline">Publish through Publisher</Link>; AppAI reviews, builds, and launches it at <code className="rounded bg-gray-100 px-1 py-0.5">/app/your-app-id</code>.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
