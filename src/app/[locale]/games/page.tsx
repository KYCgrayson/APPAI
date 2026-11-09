import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { GAMES, gamePlayHref, getGamesCopy } from "@/lib/games-catalog";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getGamesCopy(await getLocale());
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    openGraph: { title: copy.metaTitle, description: copy.metaDescription, images: ["/games/covers/river-crossing.svg"] },
  };
}

export default async function GamesPage() {
  const locale = await getLocale();
  const copy = getGamesCopy(locale);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader currentSection="games" />

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
          </div>
        </section>

        <section aria-label={copy.label} className="px-4 pb-20 sm:px-6">
          <ul className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game) => {
              const g = copy.games[game.slug];
              const href = gamePlayHref(game, locale);
              return (
                <li key={game.slug} className="flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
                  {/* Plain <a>: games are static files outside the app router. */}
                  <a href={href} tabIndex={-1} aria-hidden="true" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin SVG cover; no optimisation needed. */}
                    <img src={game.cover} alt="" width={640} height={360} className="aspect-video w-full object-cover" />
                  </a>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">{g.name}</h2>
                      {game.status === "beta" && (
                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300">{copy.beta}</span>
                      )}
                    </div>
                    <p className="mt-2 leading-relaxed text-gray-300">{g.tagline}</p>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-950/70 px-3 py-2">
                        <dt className="text-xs text-gray-500">{copy.players}</dt>
                        <dd className="mt-0.5 text-gray-100">{g.players}</dd>
                      </div>
                      <div className="rounded-lg bg-gray-950/70 px-3 py-2">
                        <dt className="text-xs text-gray-500">{copy.ages}</dt>
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
                      <a
                        href={href}
                        className="flex min-h-12 w-full items-center justify-center rounded-xl px-6 font-semibold text-gray-950 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ backgroundColor: game.accent }}
                      >
                        {copy.play}
                        <span className="sr-only">: {g.name}</span>
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <PlatformFooter />
    </div>
  );
}
