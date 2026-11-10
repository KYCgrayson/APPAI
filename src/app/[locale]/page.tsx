import { platformMetadata } from "@/lib/platform-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return platformMetadata(params, "home");
}

export const dynamic = "force-dynamic";

import { serializeJsonLd } from "@/lib/json-ld";
import { getLocale, getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { AppCard } from "@/components/AppCard";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { groupByKey, pickByLocale } from "@/lib/locale-match";
import { getDirectoryCopy } from "@/lib/directory-copy";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const directoryCopy = getDirectoryCopy(locale);

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

  // Same treatment as the directory: show each app's tagline in the visitor's
  // language when its hosted page was published in that language.
  const homeSlugs = [...featuredApps, ...recentApps]
    .map((a) => a.hostedPageSlug)
    .filter((s): s is string => !!s);
  const homeVariants = homeSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: homeSlugs }, isPublished: true },
        select: { slug: true, locale: true, isDefault: true, title: true, tagline: true },
      })
    : [];
  const variantsBySlug = groupByKey(homeVariants, (h) => h.slug);
  const localizedFor = (slug: string | null) =>
    slug ? pickByLocale(variantsBySlug.get(slug) ?? [], locale) : undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Agent discovery metadata lives in src/app/layout.tsx. */}
      <PlatformHeader />

      {/* Hero */}
      <section className="relative py-28 md:py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/40 via-gray-950 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className={`text-4xl sm:text-5xl md:text-6xl font-bold mb-6 tracking-tight text-white text-balance ${["ja", "ko", "zh-CN", "zh-TW"].includes(locale) ? "[word-break:keep-all]" : "break-words [overflow-wrap:anywhere]"}`}>
            {t.rich("heroTitle1", { wbr: () => <wbr /> })}
            {" "}
            <br />
            <span className="text-cyan-400">{t.rich("heroTitle2", { wbr: () => <wbr /> })}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("heroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <NextLink
              href="/dashboard"
              className="inline-block bg-cyan-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20"
            >
              {t("getStarted")}
            </NextLink>
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

      {/* Public directory entrances */}
      <section aria-labelledby="directory-entrances" className="border-y border-gray-800 bg-gray-900/40 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 id="directory-entrances" className="text-center text-3xl font-bold text-white">{directoryCopy.entranceTitle}</h2>
          <p className="mx-auto mb-8 mt-3 max-w-2xl text-center text-gray-400">{directoryCopy.entranceDescription}</p>
          <div className="grid gap-5 md:grid-cols-3">
            {(["websites", "tools", "apps"] as const).map((section) => {
              const item = directoryCopy.entrances[section];
              return (
                <Link key={section} href={section === "apps" ? "/apps?kind=apps" : `/${section}`} className="group rounded-2xl border border-gray-800 bg-gray-950 p-6 transition-colors hover:border-cyan-700/70">
                  <p className="text-xs uppercase tracking-widest text-cyan-400">{directoryCopy.categories[section]}</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-relaxed text-gray-400">{item.description}</p>
                  <span className="mt-5 inline-block text-sm font-medium text-cyan-300 group-hover:text-cyan-200">{item.action} <span aria-hidden="true">→</span></span>
                </Link>
              );
            })}
          </div>
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
          <p className="text-center text-gray-400 mb-8">{t("forAgentsDesc")}</p>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {([
              ["Hosted", "pages"],
              ["Wrapped", "tools"],
              ["Connected", "tools"],
              ["App", "apps"],
            ] as const).map(([kind, topic]) => (
              <a key={kind} href={`https://appai.info/spec/${topic}`} className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-2xl p-6">
                <h3 className="font-semibold text-cyan-400 mb-2">{t(`agent${kind}Name`)}</h3>
                <p className="text-sm text-gray-400">{t(`agent${kind}Desc`, { slug: "{slug}", appId: "{appId}" })}</p>
              </a>
            ))}
          </div>
          <div className="text-center space-y-4">
            <a href="https://appai.info/spec" className="inline-block bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-semibold">{t("readSpec")}</a>
            <p className="text-sm text-gray-400">{t("agentAuthorization")}</p>
            <p className="text-sm text-gray-400">{t("agentLanguages")}</p>
            <p className="text-sm text-gray-400"><a href="https://appai.info/llms-full.txt" className="text-cyan-400 hover:underline">{t("agentFallback")}</a></p>
          </div>
          <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto mt-6"><code>{t("agentReadCommands")}</code></pre>
          <p className="text-sm text-gray-400 mt-4">{t("agentAppFlow")}</p>
          <p className="text-xs text-gray-500 mt-2">{t("agentAppSafety")}</p>
          <details className="bg-gray-900 border border-gray-800 rounded-xl p-5 mt-6">
            <summary className="cursor-pointer font-semibold text-gray-200">{t("agentSkillTitle")}</summary>
            <p className="text-sm text-gray-400 my-3">{t("agentSkillDesc")}</p>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto"><code>{t("agentSkillCommands")}</code></pre>
            <a href="https://github.com/KYCgrayson/appai-skill" className="inline-block text-sm text-cyan-400 hover:underline mt-3">{t("viewGithub")}</a>
          </details>
        </div>
      </section>

      {/* Featured Apps */}
      {featuredApps.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-white">{t("featuredApps")}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
                  localizedName={localizedFor(app.hostedPageSlug)?.title}
                  localizedTagline={localizedFor(app.hostedPageSlug)?.tagline}
                />
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
                <AppCard
                  key={app.id}
                  app={app}
                  href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
                  localizedName={localizedFor(app.hostedPageSlug)?.title}
                  localizedTagline={localizedFor(app.hostedPageSlug)?.tagline}
                />
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
          __html: serializeJsonLd({
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
          <NextLink
            href="/dashboard"
            className="inline-block bg-cyan-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20"
          >
            {t("getStarted")}
          </NextLink>
        </div>
      </section>

      <PlatformFooter />
    </div>
  );
}

