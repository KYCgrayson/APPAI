import type { Metadata } from "next";
import { GAMES, TABLETOP_COLLECTION, gamePageHref, getGamesCopy, type GameEntry } from "./games-catalog.ts";
import { gameContentLocale, getGamePageCopy } from "./games-pages-copy.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";
import { buildPlatformMetadata, platformUrl } from "./platform-seo.ts";

export function buildGamePageMetadata(game: { slug: string; cover: string }, locale: string): Metadata {
  const copy = getGamePageCopy(locale, game.slug);
  const name = getGamesCopy(locale).games[game.slug].name;
  const metadata = buildPlatformMetadata(locale, gamePageHref(game), {
    title: copy.metaTitle, description: copy.description,
  });
  const image = new URL(game.cover, PLATFORM_ORIGIN).href;
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [{ url: image, width: 640, height: 360, alt: name }] },
    twitter: { ...metadata.twitter, images: [image] },
  };
}

export function gameBreadcrumbs(locale: string, slug?: string) {
  const hub = getGamesCopy(locale);
  return [
    { name: "AppAI", href: "/" },
    { name: hub.nav, href: "/games" },
    ...(slug ? [{ name: hub.games[slug].name, href: `/games/${slug}` }] : []),
  ];
}

export function buildGameBreadcrumbJsonLd(locale: string, slug?: string) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: gameBreadcrumbs(locale, slug).map(({ name, href }, index) => ({
      "@type": "ListItem", position: index + 1, name, item: platformUrl(href, locale),
    })),
  };
}

export function buildCollectionPageJsonLd(locale: string) {
  const slug = TABLETOP_COLLECTION.slug;
  const copy = getGamePageCopy(locale, slug);
  const url = platformUrl(gamePageHref(TABLETOP_COLLECTION), locale);
  return [
    {
      "@context": "https://schema.org", "@type": "CollectionPage", url,
      name: getGamesCopy(locale).games[slug].name, description: copy.description,
      image: new URL(TABLETOP_COLLECTION.cover, PLATFORM_ORIGIN).href,
      inLanguage: gameContentLocale(locale),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: GAMES.filter((game) => game.puzzle).map((game, index) => ({
          "@type": "ListItem", position: index + 1,
          name: getGamesCopy(locale).games[game.slug].name, url: platformUrl(gamePageHref(game), locale),
        })),
      },
    },
    buildGameFaqJsonLd(locale, slug),
    buildGameBreadcrumbJsonLd(locale, slug),
  ];
}

export function buildGameFaqJsonLd(locale: string, slug: string) {
  const copy = getGamePageCopy(locale, slug);
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    url: platformUrl(`/games/${slug}`, locale), inLanguage: gameContentLocale(locale),
    mainEntity: copy.faq.map(({ question, answer }) => ({
      "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function buildGamePageJsonLd(game: GameEntry, locale: string) {
  const copy = getGamePageCopy(locale, game.slug);
  const url = platformUrl(gamePageHref(game), locale);
  return [
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: getGamesCopy(locale).games[game.slug].name,
      description: copy.description,
      url,
      image: new URL(game.cover, PLATFORM_ORIGIN).href,
      genre: copy.genre,
      numberOfPlayers: {
        "@type": "QuantitativeValue", minValue: game.playerRange.min, maxValue: game.playerRange.max,
      },
      audience: { "@type": "PeopleAudience", suggestedMinAge: game.minAge },
      typicalAgeRange: `${game.minAge}-`,
      inLanguage: gameContentLocale(locale),
      isAccessibleForFree: true,
      applicationCategory: "Game",
      operatingSystem: "Any",
    },
    buildGameFaqJsonLd(locale, game.slug),
    buildGameBreadcrumbJsonLd(locale, game.slug),
  ];
}
