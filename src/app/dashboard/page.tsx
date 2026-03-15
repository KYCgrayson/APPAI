import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const orgId = (session as any)?.organizationId;

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
          <div className="text-gray-500">Apps</div>
          <div className="text-xs text-gray-400 mt-1">
            {org?.plan === "FREE" ? `${appCount}/1 used` : "Unlimited"}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl font-bold">{keyCount}</div>
          <div className="text-gray-500">Active API Keys</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
        <ol className="space-y-3 text-gray-600">
          <li>
            1.{" "}
            <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
              Generate an API Key
            </Link>
          </li>
          <li>
            2. Give the key to your AI Agent (Claude, GPT, Codex...)
          </li>
          <li>
            3. Tell your AI: &quot;Help me create a landing page on AIGA&quot;
          </li>
          <li>
            4. Your page will be live at{" "}
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
              aiga.tw/p/your-app-name
            </code>
          </li>
        </ol>
      </div>
    </div>
  );
}
