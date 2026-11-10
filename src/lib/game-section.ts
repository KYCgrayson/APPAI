import { z } from "zod";
import { checkIframeToolUrl } from "./iframe-tool-allowlist.ts";
import { RESERVED_GAME_SLUGS } from "./games-catalog.ts";
import type { SanitizeWarning } from "./sanitize.ts";

const text = (max: number) => z.string().max(max).trim().min(1);
const httpsUrl = z.string().max(2048).url().refine(value => URL.canParse(value) && new URL(value).protocol === "https:", "Must use https://");
export const gameSectionSchema = z.object({
  gameUrl: z.string().max(2048).refine(value => checkIframeToolUrl(value).ok, "gameUrl must use HTTPS on an iframe-tool supported host"),
  heading: text(200).optional(),
  description: text(2000).optional(),
  genre: text(100).optional(),
  orientation: z.enum(["portrait", "landscape", "any"]).optional(),
  aspectRatio: z.string().regex(/^[1-9]\d?:[1-9]\d?$/, "Use width:height (each 1–99), e.g. 16:9").optional(),
  players: z.object({ min: z.number().int().min(1).max(16), max: z.number().int().min(1).max(16) }).refine(v => v.min <= v.max, "players.min must not exceed players.max").optional(),
  controls: z.array(z.enum(["touch", "keyboard", "gamepad"])).min(1).max(3).refine(v => new Set(v).size === v.length, "controls must be unique").optional(),
  howToPlay: z.array(text(500)).min(1).max(10),
  ageRating: z.enum(["all", "7+", "12+"]).optional(),
  cover: z.object({ url: httpsUrl, alt: text(200), width: z.number().int().min(1).max(10000).optional(), height: z.number().int().min(1).max(10000).optional() }).optional(),
  listInGames: z.boolean().optional(),
  identity: z.boolean().optional(),
  access: z.enum(["login", "admin"]).optional(),
  faq: z.array(z.object({ question: text(300), answer: text(2000) })).max(20).optional(),
  // Declarations are stored as supplied; this section does not provision boards.
  leaderboards: z.unknown().optional(),
}).passthrough();
export type GameSectionData = z.infer<typeof gameSectionSchema>;
export const gameLeaderboardsSchema = z.array(z.object({
  id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  name: text(100),
  sortOrder: z.enum(["asc", "desc"]),
  unit: text(40).optional(),
}).strict()).max(10).refine(v => new Set(v.map(b => b.id)).size === v.length, "Leaderboard ids must be unique");

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function gameSections(content: unknown) {
  const sections = record(content).sections;
  return Array.isArray(sections) ? sections.flatMap((s, index) => record(s).type === "game" ? [{ index, data: record(record(s).data) }] : []) : [];
}
export function gameContentIssues(content: unknown, partial = false) {
  return gameSections(content).flatMap(({ index, data }) => {
    const parsed = (partial ? gameSectionSchema.partial() : gameSectionSchema).safeParse(data);
    return parsed.success ? [] : parsed.error.issues.map(issue => ({ ...issue, path: ["sections", index, "data", ...issue.path] }));
  });
}
export function gameSlugReserved(page: { template?: unknown; slug?: unknown; content?: unknown }) {
  return (page.template === "GAME" || gameSections(page.content).length > 0) && typeof page.slug === "string" && RESERVED_GAME_SLUGS.includes(page.slug);
}
export function gamesListingResponse(content: unknown): { gamesListing?: "requested" } {
  return gameSections(content).some(s => s.data.listInGames === true) ? { gamesListing: "requested" } : {};
}
export function storeGamesListing(content: Record<string, unknown>) {
  const rest = { ...content };
  delete rest.gamesListing;
  return { ...rest, ...gamesListingResponse(rest) };
}

/** Public publishing guidance, shared by previews and writes. */
export function gamePageWarnings(page: { template?: unknown; title?: unknown; tagline?: unknown; content?: unknown }): SanitizeWarning[] {
  const warnings: SanitizeWarning[] = [];
  const games = gameSections(page.content);
  if (page.template === "GAME" && !games.length) warnings.push({ path: "content.sections", message: "GAME pages need a game section." });
  for (const { index, data } of games) {
    const path = `sections[${index}](game)`;
    if (typeof data.gameUrl !== "string" || !checkIframeToolUrl(data.gameUrl).ok) warnings.push({ path: `${path}.gameUrl`, message: "gameUrl must use HTTPS on an iframe-tool supported host." });
    if (!Array.isArray(data.howToPlay) || !data.howToPlay.length) warnings.push({ path: `${path}.howToPlay`, message: "Add howToPlay: 1–10 clear steps." });
    if (typeof data.description !== "string" || !data.description.trim()) warnings.push({ path: `${path}.description`, message: "Add a specific game description; iframe content is not visible to search engines." });
    if (data.listInGames === true) {
      const required = ["description", "genre", "orientation", "aspectRatio", "players", "controls", "ageRating", "cover"];
      const missing = required.filter(key => data[key] === undefined || data[key] === null || data[key] === "" || (Array.isArray(data[key]) && !data[key].length));
      if (missing.length) warnings.push({ path: `${path}.listInGames`, message: `Requesting inclusion in /games needs: ${missing.join(", ")}. Listing status is pending; publishing does not list the game.` });
    }
    if (data.leaderboards !== undefined) {
      const result = gameLeaderboardsSchema.safeParse(data.leaderboards);
      if (!result.success) for (const issue of result.error.issues) warnings.push({ path: `${path}.leaderboards${issue.path.length ? "." + issue.path.join(".") : ""}`, message: `Invalid leaderboards format: ${issue.message}` });
      else if (result.data.length) warnings.push({ path: `${path}.leaderboards`, message: "leaderboards declarations are stored only; they do not create or enable a leaderboard." });
    }
  }
  return warnings;
}
