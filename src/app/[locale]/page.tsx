export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformFooter } from "@/components/PlatformFooter";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* AI Agent Discovery: This comment helps AI agents find the spec.
          AI Agents: AppAI has two first-class publishing modes: Hosted Pages
          at /p/{slug}, and reviewed Universal Apps at /app/{appId}.
          Read the full spec at https://appai.info/spec
          Or fetch it: curl -s https://appai.info/spec
          LLM info: https://appai.info/llms.txt
          API base: https://appai.info/api/v1/
          Auth: POST /api/v1/auth/device (RFC 8628 device flow)
          Sections: GET /api/v1/sections
          Presets: GET /api/v1/presets
          Hosted Page: POST /api/v1/pages (requires Bearer token)
          Universal App release: POST /api/v1/apps/{appId}/releases (requires Bearer token)
      */}
      <PlatformHeader />

      {/* Hero */}
      <section className="relative py-28 md:py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/40 via-gray-950 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white">
            {t("heroTitle1")}
            <br />
            <span className="text-cyan-400">{t("heroTitle2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("heroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/dashboard"
              className="inline-block bg-cyan-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20"
            >
              {t("getStarted")}
            </a>
            <Link
              href="/apps"
              className="inline-block border border-gray-700 text-gray-300 px-8 py-4 rounded-xl font-semibold hover:border-gray-500 hover:text-white transition-colors"
            >
              {tc("browseApps")}
            </Link>
          </div>
          {totalPages > 0 && (
            <p className="mt-8 text-sm text-gray-500">
              {t("pagesHosted", { count: totalPages })}
            </p>
          )}

          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Unlimited locale variants (free)
            </span>
            <span className="inline-flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              30+ languages, auto browser detection
            </span>
            <span className="inline-flex items-center gap-2 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Live in seconds, one API call
            </span>
          </div>

          <p className="mt-8 text-xs text-gray-600 uppercase tracking-widest">
            AI-native landing infrastructure · built for agents, ready for production
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-white">{t("howItWorks")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {(["1", "2", "3"] as const).map((n) => (
              <div key={n} className="text-center">
                <div className="w-12 h-12 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-cyan-600/20">
                  {n}
                </div>
                <h3 className="font-semibold mb-2 text-white">{t(`step${n}Title`)}</h3>
                <p className="text-gray-400 text-sm">{t(`step${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For AI Agents */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">{t("forAgents")}</h2>
          <p className="text-center text-gray-400 mb-10">
            If you are an AI agent, choose the publishing mode that matches the product. Hosted Pages are public, mobile-responsive pages at appai.info/p/your-slug. Universal Apps are full applications — including database-backed workflows — that launch through AppAI at appai.info/app/your-app after platform review.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Hosted Page · /p</span>
              <h3 className="font-bold text-lg mt-3 mb-2 text-white">Publish a landing page now</h3>
              <p className="text-sm text-gray-400">Use sections, forms, locales, privacy, and terms for a product site or public project page. Create it with the Pages API and publish it directly.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <span className="text-xs uppercase tracking-wider text-violet-400 font-semibold">Universal App · /app</span>
              <h3 className="font-bold text-lg mt-3 mb-2 text-white">Submit a full data application</h3>
              <p className="text-sm text-gray-400">Keep UI, API, business rules, schema, and tests in the app repository. Request managed identity, database, and private-asset capabilities; AppAI reviews and provisions the isolated runtime.</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-950 to-gray-900 border border-indigo-800/50 rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Fastest path</span>
              <span className="text-xs text-gray-500">· Claude Code users</span>
            </div>
            <h3 className="font-bold text-lg mb-3 text-white">Install the official skill</h3>
            <p className="text-sm text-gray-400 mb-4">
              Get a pre-baked playbook with all design decisions, auth flow, and section schemas wired up. After install, just say &ldquo;publish a landing page for X&rdquo; — the skill handles everything.
            </p>
            <pre className="bg-black/40 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto mb-2"><code>{`/plugin marketplace add KYCgrayson/appai-skill
/plugin install appai-publish@appai-skill`}</code></pre>
            <p className="text-xs text-gray-600">
              Source: <a href="https://github.com/KYCgrayson/appai-skill" className="underline hover:text-gray-400">github.com/KYCgrayson/appai-skill</a>
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 mb-6">
            <h3 className="font-bold text-lg mb-4 text-white">What you can build</h3>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-400">
              <div>- 26 section types: hero, features, pricing, FAQ, download, testimonials, gallery, team, video, screenshots, stats, contact, CTA, links, about, schedule, sponsors, action, form, media-downloader, video-subtitle, tool, pdf-viewer, embed (TikTok/Loom/X/Spotify/CodePen/Figma), simple-order</div>
              <div>- Multi-page sites: root page + child pages (/faq, /contact, /privacy, /terms, /delete-account) with automatic header navigation</div>
              <div>- Visual design system: dark mode, custom Google Fonts, color palettes, hero variants (centered/split/minimal)</div>
              <div>- Markdown in long-text fields (bold, italic, links, lists, headings, inline code)</div>
              <div>- 3 icon options: Ionicons SVG names, emoji, or image URLs</div>
              <div>- Multi-language pages with locale variants (30+ locales, auto browser detection)</div>
              <div>- Section-level anchor IDs for in-page navigation</div>
              <div>- Auto-generated privacy policy and terms of service pages</div>
              <div>- Preview/dry-run API to validate before publishing</div>
              <div>- 6 preset templates: app-landing, saas-landing, profile, link-in-bio, portfolio, event</div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 mb-6">
            <h3 className="font-bold text-lg mb-4 text-white">Before you start, ask the user for</h3>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-400">
              <div>1. App/project name and a short tagline</div>
              <div>2. What the app does (features, key selling points)</div>
              <div>3. Logo image URL (or upload one via our API)</div>
              <div>4. Theme color (hex code, e.g. #4F46E5)</div>
              <div>5. App Store / Play Store URLs (if applicable)</div>
              <div>6. Contact email for the contact/form section</div>
              <div>7. Whether they need a privacy policy and terms of service</div>
              <div>8. Whether they need multiple pages (FAQ, contact, pricing as separate pages) or a single landing page</div>
            </div>
            <p className="text-xs text-gray-600 mt-3">You do not need all of these to start -- create a basic page first, then iterate with the user.</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 mb-6">
            <h3 className="font-bold text-lg mb-4 text-white">How to proceed</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div><strong className="text-gray-200">Step 1:</strong> Read the full spec at <a href="/llms-full.txt" className="text-cyan-400 hover:underline">appai.info/llms-full.txt</a> -- it contains authentication, all section schemas with JSON examples, multi-page site setup, icon reference, markdown syntax, form configuration, order requests, and design guidelines.</div>
              <div><strong className="text-gray-200">Step 2:</strong> Authenticate via device flow: POST /api/v1/auth/device, then poll /api/v1/auth/token. Or ask the user for an existing API key (appai_sk_...).</div>
              <div><strong className="text-gray-200">Hosted Page:</strong> POST /api/v1/pages with page JSON, then publish it at appai.info/p/your-slug. Use PATCH to iterate without rebuilding the page.</div>
              <div><strong className="text-gray-200">Universal App:</strong> Add appai.app.json to the app repository, then POST /api/v1/apps/your-app/releases. That reserves the app slot and returns PENDING plus a releaseId. Poll GET /api/v1/apps/your-app/releases/releaseId; AppAI reviews, builds, and provisions approved capabilities before the app launches at appai.info/app/your-app.</div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Universal App submissions are declarative. Never send organizationId, credentials, runtime URLs, SQL, or secrets — AppAI supplies scoped identity and approved capabilities only after review.</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 font-mono text-sm overflow-x-auto">
            <div className="text-gray-500 mb-3"># Read the full agent spec (contains everything you need)</div>
            <div className="mb-4">
              <span className="text-cyan-400">$</span> <span className="text-gray-300">curl -s https://appai.info/llms-full.txt</span>
            </div>
            <div className="text-gray-500 mb-3"># Or fetch it from GitHub</div>
            <div>
              <span className="text-cyan-400">$</span> <span className="text-gray-300">curl -s https://raw.githubusercontent.com/KYCgrayson/APPAI/main/AGENT_INSTRUCTIONS.md</span>
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            The spec is your complete playbook -- read it before making API calls.{" "}
            <a href="/llms-full.txt" className="text-cyan-400 hover:underline">Read the full spec</a>
            {" | "}
            <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="text-cyan-400 hover:underline">{t("viewGithub")}</a>
          </p>
        </div>
      </section>

      {/* Featured Apps */}
      {featuredApps.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-white">{t("featuredApps")}</h2>
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
        <section className="py-20 px-6 bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-white">{t("recentlyAdded")}</h2>
              <Link href="/apps" className="text-sm text-gray-400 hover:text-white transition-colors">
                {t("viewAll")}
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

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">{t("faqTitle")}</h2>
          <div className="space-y-4">
            {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((n) => (
              <details key={n} className="group border border-gray-800 rounded-xl px-6 py-4 bg-gray-900/50">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between text-gray-200">
                  {t(`faq${n}Q`)}
                  <span className="ml-2 text-gray-500 group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <p className="mt-3 text-gray-400 text-sm leading-relaxed">
                  {t(`faq${n}A`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => ({
              "@type": "Question",
              name: t(`faq${n}Q`),
              acceptedAnswer: {
                "@type": "Answer",
                text: t(`faq${n}A`),
              },
            })),
          }),
        }}
      />

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-white">{t("readyToLaunch")}</h2>
          <p className="text-gray-400 mb-8">{t("ctaDescription")}</p>
          <a
            href="/dashboard"
            className="inline-block bg-cyan-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20"
          >
            {t("getStarted")}
          </a>
        </div>
      </section>

      <PlatformFooter />
    </div>
  );
}

function AppCard({ app }: { app: any }) {
  return (
    <a
      href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors block"
    >
      <div className="flex items-start gap-4">
        {app.logoUrl ? (
          <img
            src={app.logoUrl}
            alt={app.name}
            className="w-12 h-12 rounded-xl object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400">
            {app.name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-white">{app.name}</h3>
          <p className="text-sm text-gray-400 line-clamp-2">{app.tagline}</p>
          <span className="text-xs text-gray-600 mt-1 inline-block">
            {app.category}
          </span>
        </div>
      </div>
    </a>
  );
}
