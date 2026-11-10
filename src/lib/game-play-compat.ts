import { locales } from "../i18n/routing.ts";
import { GAMES } from "./games-catalog.ts";

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

/** Server decision: only detail routes, preserving the raw query verbatim. */
export function gamePlayServerRedirect(pathname: string, search: string): string | null {
  const match = /^\/(?:([^/]+)\/)?games\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const [, locale, slug] = match;
  if (locale && !locales.some((value) => value === locale)) return null;
  return needsGamePlayRedirect(slug, search, "") ? `/games/${slug}/play${search}` : null;
}
