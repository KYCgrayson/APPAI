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
      <PlatformHeader />

      {/* Hero */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
            {t("heroTitle1")}
            <br />
            {t("heroTitle2")}
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t("heroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/dashboard"
              className="inline-block bg-black text-white px-8 py-4 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              {t("getStarted")}
            </a>
            <Link
              href="/apps"
              className="inline-block border-2 border-gray-200 px-8 py-4 rounded-xl font-semibold hover:border-gray-400 transition-colors"
            >
              {tc("browseApps")}
            </Link>
          </div>
          {totalPages > 0 && (
            <p className="mt-6 text-sm text-gray-400">
              {t("pagesHosted", { count: totalPages })}
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">{t("howItWorks")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">{t("step1Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step1Desc")}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">{t("step2Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step2Desc")}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">{t("step3Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* For AI Agents */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{t("forAgents")}</h2>
          <p className="text-center text-gray-600 mb-10">{t("forAgentsDesc")}</p>
          <div className="bg-gray-900 text-gray-100 rounded-2xl p-8 font-mono text-sm overflow-x-auto">
            <div className="text-gray-400 mb-3">{t("codeComment1")}</div>
            <div className="mb-4">
              <span className="text-green-400">$</span> curl -s https://appai.info/spec
            </div>
            <div className="text-gray-400 mb-3">{t("codeComment2")}</div>
            <div>
              <span className="text-green-400">$</span> curl -s https://raw.githubusercontent.com/KYCgrayson/APPAI/main/AGENT_INSTRUCTIONS.md
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            {t("specNote")}{" "}
            <a href="/spec" className="text-blue-600 hover:underline">{t("readSpec")}</a>
            {" | "}
            <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="text-blue-600 hover:underline">{t("viewGithub")}</a>
          </p>
        </div>
      </section>

      {/* Featured Apps */}
      {featuredApps.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">{t("featuredApps")}</h2>
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
              <h2 className="text-3xl font-bold">{t("recentlyAdded")}</h2>
              <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
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
          <h2 className="text-3xl font-bold text-center mb-12">{t("faqTitle")}</h2>
          <div className="space-y-6">
            {(["1", "2", "3", "4", "5", "6"] as const).map((n) => (
              <details key={n} className="group border rounded-xl px-6 py-4">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  {t(`faq${n}Q`)}
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm leading-relaxed">
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
            mainEntity: ["1", "2", "3", "4", "5", "6"].map((n) => ({
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
          <h2 className="text-3xl font-bold mb-4">{t("readyToLaunch")}</h2>
          <p className="text-gray-600 mb-8">{t("ctaDescription")}</p>
          <a
            href="/dashboard"
            className="inline-block bg-black text-white px-8 py-4 rounded-xl font-semibold hover:bg-gray-800"
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
    </a>
  );
}
