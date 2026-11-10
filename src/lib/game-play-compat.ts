import { locales } from "../i18n/routing.ts";
import { GAMES, getOwnGame, gameLocaleValue } from "./games-catalog.ts";

// Derived from the checked-in game sources and their deployed public builds.
// locale (puzzles/duel) and lang (werewolf) alone keep the description page.
// Once play state is present, the entire search string travels with it.
const GAME_STATE_QUERY_PARAMS: Record<string, readonly string[]> = {
  ...Object.fromEntries(GAMES.filter((game) => game.puzzle).map(({ slug }) => [slug,
    ["game", "level", "challenge", "c", "t", "n", "claim", "theme", "color", "debug"],
  ])),
  "guess-duel": ["room", "theme", "color", "api", "debug"],
  werewolf: [],
};

/** Browser decision: fragments are invisible to the server, including #r=. */
export function needsGamePlayRedirect(slug: string, search: string, hash: string): boolean {
  if (!Object.hasOwn(GAME_STATE_QUERY_PARAMS, slug)) return false;
  if (hash) return true;
  const params = new URLSearchParams(search);
  return GAME_STATE_QUERY_PARAMS[slug].some((name) => params.has(name));
}

/** Keep the raw query; append the game's language only when it is missing. */
export function gamePlaySearch(slug: string, search: string, locale?: string): string {
  const game = getOwnGame(slug);
  if (!game) return search;
  const params = new URLSearchParams(search);
  if (params.has(game.localeParam.name)) return search;
  const language = params.get("locale") ?? locale;
  if (!language) return search;
  const separator = !search ? "?" : search === "?" ? "" : "&";
  return `${search}${separator}${game.localeParam.name}=${encodeURIComponent(gameLocaleValue(game, language))}`;
}

/** Only detail routes; fragments are supplied by the browser fallback. */
export function gamePlayCompatibilityHref(pathname: string, search: string, hash = ""): string | null {
  const match = /^\/(?:([^/]+)\/)?games\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const [, locale, slug] = match;
  if (locale && !locales.some((value) => value === locale)) return null;
  return needsGamePlayRedirect(slug, search, hash) ? `/games/${slug}/play${gamePlaySearch(slug, search, locale)}${hash}` : null;
}

/** Middleware decision: the server never sees a fragment. */
export function gamePlayServerRedirect(pathname: string, search: string): string | null {
  return gamePlayCompatibilityHref(pathname, search);
}
