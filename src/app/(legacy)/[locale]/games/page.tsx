import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { GAMES, TABLETOP_COLLECTION, gamePageHref, getGamesCopy, isPlayableGame } from "@/lib/games-catalog";
import { buildPlatformMetadata, platformUrl } from "@/lib/platform-seo";
import { gameBreadcrumbs, buildGameBreadcrumbJsonLd } from "@/lib/games-page-seo";
import { getGamePageLabels, getGamesHubFaq } from "@/lib/games-pages-copy";
import { serializeJsonLd } from "@/lib/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getGamesCopy(locale);
  return buildPlatformMetadata(locale, "/games", {
    title: copy.metaTitle, description: copy.metaDescription,
  });
}

export default async function GamesPage() {
  const locale = await getLocale();
  const copy = getGamesCopy(locale);
  const labels = getGamePageLabels(locale);
  const faq = getGamesHubFaq(locale);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader currentSection="games" breadcrumbs={gameBreadcrumbs(locale)} />

      <main>
        <section aria-labelledby="games-title" className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/40 via-gray-950 to-gray-950" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl">
            <p className="text-xs uppercase tracking-widest text-emerald-400">{copy.label}</p>
            <h1 id="games-title" className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {copy.title}
            </h1>
            {copy.intro.map((p) => (
              <p key={p} className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                {p}
              </p>
            ))}
            <ul className="mt-5 space-y-1 text-sm text-gray-400">
              {copy.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
            <Link href={gamePageHref(TABLETOP_COLLECTION)} className="mt-6 inline-flex min-h-11 items-center text-emerald-300 hover:underline">{copy.games[TABLETOP_COLLECTION.slug].name} →</Link>
          </div>
        </section>

        <section aria-label={copy.label} className="px-4 pb-20 sm:px-6">
          <ul className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game) => {
              const g = copy.games[game.slug];
              const playable = isPlayableGame(game);
              const href = gamePageHref(game);
              return (
                <li key={game.slug} className="flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin SVG cover; no optimisation needed. */}
                  <img src={game.cover} alt="" width={640} height={360} className={`aspect-video w-full object-cover ${playable ? "" : "opacity-60"}`} />
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        {playable ? <Link href={href} className="hover:underline">{g.name}</Link> : g.name}
                      </h2>
                      {game.status === "beta" && (
                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300">{copy.beta}</span>
                      )}
                      {game.status === "soon" && (
                        <span className="rounded-full border border-gray-600 px-2 py-0.5 text-xs text-gray-300">{copy.soon}</span>
                      )}
                    </div>
                    <p className="mt-2 leading-relaxed text-gray-300">{g.tagline}</p>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-950/70 px-3 py-2">
                        <dt className="text-xs text-gray-400">{copy.players}</dt>
                        <dd className="mt-0.5 text-gray-100">{g.players}</dd>
                      </div>
                      <div className="rounded-lg bg-gray-950/70 px-3 py-2">
                        <dt className="text-xs text-gray-400">{copy.ages}</dt>
                        <dd className="mt-0.5 text-gray-100">{g.ages}</dd>
                      </div>
                    </dl>

                    <h3 className="mt-5 text-sm font-semibold text-gray-200">{copy.howToPlay}</h3>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-400 marker:text-gray-600">
                      {g.howToPlay.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>

                    <div className="mt-auto pt-6">
                      {playable ? (
                      <Link
                        href={href}
                        className="flex min-h-12 w-full items-center justify-center rounded-xl px-6 font-semibold text-gray-950 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ backgroundColor: game.accent }}
                      >
                        {copy.details}
                        <span className="sr-only">: {g.name}</span>
                      </Link>
                      ) : (
                        <p className="flex min-h-12 w-full items-center justify-center rounded-xl border border-gray-700 px-6 font-semibold text-gray-400">
                          {copy.soon}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="game-faq" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <h2 id="game-faq" className="scroll-mt-32 text-2xl font-semibold">{labels.faq}</h2>
          <div className="mt-5 space-y-4">{faq.map(({ question, answer }) => <details key={question} className="rounded-xl border border-gray-800 p-5">
            <summary className="cursor-pointer font-semibold">{question}</summary>
            <p className="mt-3 leading-relaxed text-gray-300">{answer}</p>
          </details>)}</div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([
        buildGameBreadcrumbJsonLd(locale),
        { "@context": "https://schema.org", "@type": "FAQPage", url: platformUrl("/games", locale), mainEntity: faq.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
      ]) }} />
      <PlatformFooter gameNavigation />
    </div>
  );
}
