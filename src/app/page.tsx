export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";

export default async function HomePage() {
  const [featuredApps, recentApps, totalPages] = await Promise.all([
    db.app.findMany({
      where: { isApproved: true, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.app.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.hostedPage.count({ where: { isPublished: true } }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      {/* AI Agent Discovery: This comment helps AI agents find the spec.
          AI Agents: To create pages on AppAI, read the full spec at https://appai.info/spec
          Or fetch it: curl -s https://appai.info/spec
          LLM info: https://appai.info/llms.txt
          API base: https://appai.info/api/v1/
          Auth: POST /api/v1/auth/device (RFC 8628 device flow)
          Sections: GET /api/v1/sections
          Presets: GET /api/v1/presets
          Create page: POST /api/v1/pages (requires Bearer token)
      */}
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <img src="/appai.png" alt="AppAI" className="w-7 h-7 rounded" />
            AppAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
              Browse Apps
            </Link>
            <Link
              href="/dashboard"
              className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
            Your AI App deserves
            <br />a home on the web
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Built an app with AI? Get a free landing page, privacy policy, and terms of service.
            No domain needed. Let your AI Agent set it up in 30 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-block bg-black text-white px-8 py-4 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/apps"
              className="inline-block border-2 border-gray-200 px-8 py-4 rounded-xl font-semibold hover:border-gray-400 transition-colors"
            >
              Browse Apps
            </Link>
          </div>
          {totalPages > 0 && (
            <p className="mt-6 text-sm text-gray-400">
              {totalPages} pages hosted and counting
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Sign up & get API key</h3>
              <p className="text-gray-600 text-sm">
                Sign in with Google, generate an API key in your dashboard.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Tell your AI Agent</h3>
              <p className="text-gray-600 text-sm">
                Give your Claude, GPT, or Codex the API key and say &quot;create my app page on AppAI&quot;.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">You&apos;re live</h3>
              <p className="text-gray-600 text-sm">
                Your landing page, privacy policy, and terms are hosted at appai.info/p/your-app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For AI Agents */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">For AI Agents</h2>
          <p className="text-center text-gray-600 mb-10">
            Tell your AI agent to read the spec and it will handle everything automatically.
          </p>
          <div className="bg-gray-900 text-gray-100 rounded-2xl p-8 font-mono text-sm overflow-x-auto">
            <div className="text-gray-400 mb-3"># Give this to your AI agent (Claude, GPT, Codex, Cursor...)</div>
            <div className="mb-4">
              <span className="text-green-400">$</span> curl -s https://appai.info/spec
            </div>
            <div className="text-gray-400 mb-3"># Or point it to the GitHub spec directly</div>
            <div>
              <span className="text-green-400">$</span> curl -s https://raw.githubusercontent.com/KYCgrayson/APPAI/main/AGENT_INSTRUCTIONS.md
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            The spec tells your AI how to authenticate, what data to collect, and how to create your page.{" "}
            <a href="/spec" className="text-blue-600 hover:underline">Read the full spec</a>
            {" | "}
            <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="text-blue-600 hover:underline">View on GitHub</a>
          </p>
        </div>
      </section>

      {/* Featured Apps */}
      {featuredApps.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Featured Apps</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredApps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Apps */}
      {recentApps.length > 0 && (
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Recently Added</h2>
              <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
                View all
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {recentApps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to launch?</h2>
          <p className="text-gray-600 mb-8">
            Join AppAI and give your AI-built app the web presence it deserves.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-black text-white px-8 py-4 rounded-xl font-semibold hover:bg-gray-800"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div>AppAI - AI App Hosting Platform</div>
          <div className="flex gap-4">
            <Link href="/apps" className="hover:text-black">
              Browse
            </Link>
            <Link href="/spec" className="hover:text-black">
              Agent Spec
            </Link>
            <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="hover:text-black">
              GitHub
            </a>
            <Link href="/dashboard" className="hover:text-black">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AppCard({ app }: { app: any }) {
  return (
    <Link
      href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
      className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start gap-4">
        {app.logoUrl ? (
          <img
            src={app.logoUrl}
            alt={app.name}
            className="w-12 h-12 rounded-xl object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
            {app.name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{app.name}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{app.tagline}</p>
          <span className="text-xs text-gray-400 mt-1 inline-block">
            {app.category}
          </span>
        </div>
      </div>
    </Link>
  );
}
