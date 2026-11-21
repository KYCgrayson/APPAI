import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { GamePlayCompatibility, GamePlayLink } from "@/components/GamePlayCompatibility";
import { GAMES, GAME_PAGE_SLUGS, TABLETOP_COLLECTION, getOwnGame, getGamesCopy, gamePageHref, gamePlayHref, isPlayableGame } from "@/lib/games-catalog";
import { getGamePageCopy, getGamePageLabels } from "@/lib/games-pages-copy";
import { buildGamePageMetadata, buildGamePageJsonLd, buildCollectionPageJsonLd, gameBreadcrumbs } from "@/lib/games-page-seo";
import { serializeJsonLd } from "@/lib/json-ld";
import { locales } from "@/i18n/routing";

type GamePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  // Complete paths let Next classify the shared request-dependent layout at
  // build time instead of failing when a partially generated path is visited.
  return locales.flatMap((locale) => GAME_PAGE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Pick<GamePageProps, "params">) {
  const { locale, slug } = await params;
  const game = getOwnGame(slug) ?? (slug === TABLETOP_COLLECTION.slug ? TABLETOP_COLLECTION : undefined);
  if (!game) notFound();
  return buildGamePageMetadata(game, locale);
}

export default async function GamePage({ params }: GamePageProps) {
  const { locale, slug } = await params;
  const game = getOwnGame(slug);
  const page = game ?? (slug === TABLETOP_COLLECTION.slug ? TABLETOP_COLLECTION : undefined);
  if (!page) notFound();
  const hub = getGamesCopy(locale);
  const summary = hub.games[slug];
  const copy = getGamePageCopy(locale, slug);
  const labels = getGamePageLabels(locale);
  const moreGames = GAMES.filter((other) => other.slug !== slug && isPlayableGame(other));
  const puzzles = GAMES.filter((other) => other.puzzle);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {game && <GamePlayCompatibility slug={slug} playHref={gamePlayHref(game, locale)} label={hub.play} />}
      <PlatformHeader currentSection="games" breadcrumbs={gameBreadcrumbs(locale, slug)} />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/games" className="text-sm text-emerald-300 hover:underline">← {labels.back}</Link>
        <article className="mt-8">
          <div className="grid items-start gap-8 md:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{summary.name}</h1>
              <p className="mt-4 text-lg leading-relaxed text-gray-300">{copy.intro}</p>
              {game?.status === "beta" && <p className="mt-4 text-sm text-amber-300">{labels.betaNotice}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-gray-400">{hub.players}</dt><dd className="mt-1">{summary.players}</dd></div>
                <div><dt className="text-gray-400">{hub.ages}</dt><dd className="mt-1">{summary.ages}</dd></div>
              </dl>
              {game && isPlayableGame(game) ? (
                <GamePlayLink
                  slug={slug}
                  href={gamePlayHref(game, locale)}
                  className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-xl px-8 text-lg font-semibold text-gray-950 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
                  style={{ backgroundColor: game.accent }}
                >
                  {hub.play}<span className="sr-only">: {summary.name}</span>
                </GamePlayLink>
              ) : game ? <p className="mt-7 text-gray-400">{hub.soon}</p> : null}
              {game?.puzzle && <Link href={gamePageHref(TABLETOP_COLLECTION)} className="mt-5 block text-emerald-300 hover:underline">{hub.games[TABLETOP_COLLECTION.slug].name} →</Link>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin SVG cover; no optimisation needed. */}
            <img src={page.cover} alt={summary.name} width={640} height={360} className="aspect-video w-full rounded-2xl border border-gray-800 object-cover" />
          </div>

          {!game && <nav aria-label={summary.name} className="mt-10">
            <ul className="grid gap-4 sm:grid-cols-3">
              {puzzles.map((puzzle) => <li key={puzzle.slug} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                <h2 className="text-xl font-semibold"><Link href={gamePageHref(puzzle)} className="text-emerald-300 hover:underline">{hub.games[puzzle.slug].name}</Link></h2>
                <p className="mt-3 text-gray-300">{hub.games[puzzle.slug].tagline}</p>
                <Link href={gamePageHref(puzzle)} className="mt-4 inline-flex min-h-11 items-center text-emerald-300 hover:underline">{hub.details} →</Link>
              </li>)}
            </ul>
          </nav>}

          <section aria-labelledby="game-background" className="mt-12 max-w-3xl">
            <h2 id="game-background" className="text-2xl font-semibold text-white">{labels.background}</h2>
            <p className="mt-4 leading-relaxed text-gray-300">{copy.background}</p>
          </section>
          <section aria-labelledby="game-instructions" className="mt-10 max-w-3xl">
            <h2 id="game-instructions" className="text-2xl font-semibold text-white">{hub.howToPlay}</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6 leading-relaxed text-gray-300 marker:text-emerald-400">
              {summary.howToPlay.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
          <section aria-labelledby="game-faq" className="mt-12 max-w-3xl">
            <h2 id="game-faq" className="scroll-mt-32 text-2xl font-semibold text-white">{labels.faq}</h2>
            <div className="mt-5 space-y-4">
              {copy.faq.map(({ question, answer }) => (
                <details key={question} className="rounded-xl border border-gray-800 bg-gray-900/50 px-5 py-4">
                  <summary className="cursor-pointer font-semibold text-gray-100">{question}</summary>
                  <p className="mt-3 leading-relaxed text-gray-300">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </article>

        <nav aria-labelledby="more-games" className="mt-12 border-t border-gray-800 pt-8">
          <h2 id="more-games" className="text-2xl font-semibold text-white">{labels.moreGames}</h2>
          <ul className="mt-4 flex flex-wrap gap-4">
            {moreGames.map((other) => (
              <li key={other.slug}><Link href={gamePageHref(other)} className="text-emerald-300 hover:underline">{hub.games[other.slug].name}</Link></li>
            ))}
          </ul>
          <Link href="/games" className="mt-5 inline-block text-sm text-gray-300 hover:underline">{labels.back}</Link>
        </nav>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(game ? buildGamePageJsonLd(game, locale) : buildCollectionPageJsonLd(locale)) }} />
      <PlatformFooter gameNavigation />
    </div>
  );
}
