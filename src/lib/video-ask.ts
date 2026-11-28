import { z } from "zod";
import { getConnector } from "./connectors/registry.ts";
import { videoFieldPath } from "./video-data.ts";

/**
 * `video-ask` section: visitors ask a question and get matching YouTube videos
 * from a video-index backend. One fixed backend contract, whether the backend
 * sits behind an owner-registered connector (/api/connect/{name}) or is a
 * third-party https URL called straight from the visitor's browser:
 *
 *   POST {base}/search  { q, lang? }            → { results: VideoAskItem[], answer: null }
 *   GET  {base}/stats   (optional)              → { totalVideos, indexedVideos, updatedAt, categories }
 *   GET  {base}/videos?category=CODE&page=N     → { results, page, hasMore }
 *
 * Every response is parsed defensively: a malformed backend degrades to the
 * "search paused" state, it never throws into the page.
 */

/**
 * Browser-direct backends (`backendUrl`, and the visitor's "Where to ask"
 * custom backend) let published content reach infrastructure that is not an
 * owner-registered connector, which conflicts with the CLAUDE.md product
 * boundary. Kept behind this flag, OFF, until the owner decides (#146).
 * With it off, validation rejects `backendUrl` and the selector is hidden.
 */
export const VIDEO_ASK_ALLOW_DIRECT_BACKENDS = false;

export const VIDEO_ASK_MODES = ["floating", "inline"] as const;
export type VideoAskMode = (typeof VIDEO_ASK_MODES)[number];

const MAX_URL = 2048;

/** https only, parseable, no credentials. Used for agent data and visitor-added backends. */
export function isHttpsBackendUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL) return false;
  if (/\s/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
}

export const videoAskSectionSchemaFor = (allowDirect: boolean) => z.object({
  heading: z.string().min(1).max(120).optional(),
  subheading: z.string().min(1).max(200).optional(),
  intro: z.string().min(1).max(500).optional(),
  mode: z.enum(VIDEO_ASK_MODES).optional(),
  connector: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "connector must be a registered connector name").optional(),
  backendUrl: z.string().refine(isHttpsBackendUrl, "backendUrl must be an https:// URL without credentials (max 2048 characters)").optional(),
  allowCustomBackend: z.boolean().optional(),
  placeholder: z.string().min(1).max(120).optional(),
  disclaimer: z.string().min(1).max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.backendUrl && !allowDirect) {
    ctx.addIssue({ code: "custom", path: ["backendUrl"], message: "backendUrl is not enabled on AppAI; use connector (an owner-registered connector name)" });
  }
  if (data.connector && data.backendUrl) {
    ctx.addIssue({ code: "custom", path: ["backendUrl"], message: "set either connector or backendUrl, not both" });
  } else if (!data.connector && !data.backendUrl) {
    ctx.addIssue({ code: "custom", path: ["connector"], message: allowDirect
      ? "set connector (an owner-registered connector name) or backendUrl (https)"
      : "set connector (an owner-registered connector name)" });
  }
  if (data.connector && !getConnector(data.connector)) {
    ctx.addIssue({ code: "custom", path: ["connector"], message: `unknown connector "${data.connector}"` });
  }
});

export const videoAskSectionSchema = videoAskSectionSchemaFor(VIDEO_ASK_ALLOW_DIRECT_BACKENDS);

export type VideoAskSectionData = z.infer<typeof videoAskSectionSchema>;

/** Page-content issues for every video-ask section, in the validator's shape. */
export function videoAskContentIssues(content: unknown, allowDirect = VIDEO_ASK_ALLOW_DIRECT_BACKENDS) {
  const schema = allowDirect === VIDEO_ASK_ALLOW_DIRECT_BACKENDS ? videoAskSectionSchema : videoAskSectionSchemaFor(allowDirect);
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  const sections = (content as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return issues;
  sections.forEach((value, index) => {
    const section = value as { type?: string; data?: unknown } | null;
    if (section?.type !== "video-ask") return;
    const parsed = schema.safeParse(section.data ?? {});
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const path = ["sections", index, "data", ...issue.path] as (string | number)[];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: ${issue.message}` });
    }
  });
  return issues;
}

/** The section's configured backend base, or null when nothing usable is configured. */
export function configuredBackendBase(data: { connector?: unknown; backendUrl?: unknown }, allowDirect = VIDEO_ASK_ALLOW_DIRECT_BACKENDS): string | null {
  if (typeof data.connector === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(data.connector)) {
    return `/api/connect/${data.connector}`;
  }
  // Same-origin paths are only reachable from trusted (non-agent) callers such
  // as the dev preview; published data is validated to https above.
  if (typeof data.backendUrl === "string" && ((allowDirect && isHttpsBackendUrl(data.backendUrl)) || /^\/(?![\/\\])/.test(data.backendUrl))) {
    return data.backendUrl;
  }
  return null;
}

export function backendEndpoint(base: string, path: "search" | "stats" | "videos", query?: Record<string, string>): string {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  return `${base.replace(/\/+$/, "")}/${path}${qs}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export type LocalizedLabel = string | Record<string, string>;

export interface VideoAskCategory {
  code: string;
  label: LocalizedLabel;
}

export interface VideoAskItem {
  videoId: string;
  title: string;
  author: string;
  language: string;
  summary: string;
  category: VideoAskCategory | null;
  embeddable: boolean;
  thumbnail: string;
}

export interface VideoAskStats {
  totalVideos: number | null;
  indexedVideos: number | null;
  updatedAt: string | null;
  categories: (VideoAskCategory & { count: number | null })[];
}

export interface VideoAskPage {
  results: VideoAskItem[];
  page: number;
  hasMore: boolean;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_TEXT = 500;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function label(value: unknown): LocalizedLabel | null {
  if (typeof value === "string") return value.trim() ? value.trim().slice(0, 80) : null;
  if (!isObject(value)) return null;
  const entries = Object.entries(value)
    .filter(([k, v]) => /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(k) && typeof v === "string" && v.trim())
    .map(([k, v]) => [k, (v as string).trim().slice(0, 80)] as const);
  return entries.length ? Object.fromEntries(entries) : null;
}

function category(value: unknown): VideoAskCategory | null {
  if (!isObject(value)) return null;
  const code = text(value.code, 64);
  if (!code) return null;
  return { code, label: label(value.label) ?? code };
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Official privacy-enhanced embed, from the beginning (no start second). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function parseVideoItem(value: unknown): VideoAskItem | null {
  if (!isObject(value)) return null;
  const videoId = typeof value.videoId === "string" ? value.videoId.trim() : "";
  const title = text(value.title, 300);
  if (!YOUTUBE_ID.test(videoId) || !title) return null;
  return {
    videoId,
    title,
    author: text(value.author, 120),
    language: text(value.language, 20),
    summary: text(value.summary),
    category: category(value.category),
    // Only an explicit true plays inline; anything else falls back to the link.
    embeddable: value.embeddable === true,
    thumbnail: isHttpsBackendUrl(value.thumbnail) ? value.thumbnail : youtubeThumbnail(videoId),
  };
}

function items(value: unknown, max: number): VideoAskItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: VideoAskItem[] = [];
  for (const raw of value) {
    const item = parseVideoItem(raw);
    if (!item || seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export const SEARCH_RESULT_LIMIT = 5;
export const BROWSE_PAGE_LIMIT = 50;

/** null = the response is not the search contract at all (→ "search paused"). */
export function parseSearchResponse(value: unknown): { results: VideoAskItem[] } | null {
  if (!isObject(value) || !Array.isArray(value.results)) return null;
  return { results: items(value.results, SEARCH_RESULT_LIMIT) };
}

export function parseStatsResponse(value: unknown): VideoAskStats | null {
  if (!isObject(value)) return null;
  const categories = Array.isArray(value.categories)
    ? value.categories.flatMap(raw => {
      const cat = category(raw);
      return cat ? [{ ...cat, count: count((raw as Record<string, unknown>).count) }] : [];
    }).slice(0, 40)
    : [];
  const totalVideos = count(value.totalVideos);
  const indexedVideos = count(value.indexedVideos);
  if (totalVideos === null && indexedVideos === null && categories.length === 0) return null;
  return { totalVideos, indexedVideos, updatedAt: text(value.updatedAt, 40) || null, categories };
}

export function parseVideosResponse(value: unknown): VideoAskPage | null {
  if (!isObject(value) || !Array.isArray(value.results)) return null;
  const page = count(value.page);
  return { results: items(value.results, BROWSE_PAGE_LIMIT), page: page && page > 0 ? page : 1, hasMore: value.hasMore === true };
}

/** Category label for the visitor: exact locale → language → en → first. */
export function categoryLabel(value: LocalizedLabel, locale: string): string {
  if (typeof value === "string") return value;
  const keys = Object.keys(value);
  const lower = locale.toLowerCase();
  const exact = keys.find(k => k.toLowerCase() === lower);
  if (exact) return value[exact];
  const primary = lower.split("-")[0];
  const bare = keys.find(k => k.toLowerCase() === primary) ?? keys.find(k => k.toLowerCase().split("-")[0] === primary);
  if (bare) return value[bare];
  return value.en ?? value[keys[0]] ?? "";
}

// ---------------------------------------------------------------------------
// Fetching (browser side; fetch is injectable for tests)
// ---------------------------------------------------------------------------

export const VIDEO_ASK_TIMEOUT_MS = 12_000;

export class VideoAskBackendError extends Error {
  status: number;
  constructor(status: number) {
    super(`backend ${status}`);
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function getJson(fetchImpl: FetchLike, url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIDEO_ASK_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal, credentials: "omit", cache: "no-store" });
    if (!res.ok) throw new VideoAskBackendError(res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchSearch(base: string, q: string, lang: string | undefined, fetchImpl: FetchLike = fetch, signal?: AbortSignal) {
  const body = JSON.stringify(lang ? { q, lang } : { q });
  const parsed = parseSearchResponse(await getJson(fetchImpl, backendEndpoint(base, "search"), {
    method: "POST", headers: { "content-type": "application/json" }, body,
  }, signal));
  if (!parsed) throw new Error("malformed search response");
  return parsed;
}

/**
 * null = the backend does not offer /stats (404): show just the search box.
 * Network errors, 5xx, timeouts and malformed bodies reject: "search paused".
 */
export async function fetchStats(base: string, fetchImpl: FetchLike = fetch, signal?: AbortSignal): Promise<VideoAskStats | null> {
  let body: unknown;
  try {
    body = await getJson(fetchImpl, backendEndpoint(base, "stats"), { method: "GET" }, signal);
  } catch (error) {
    if (error instanceof VideoAskBackendError && error.status === 404) return null;
    throw error;
  }
  const parsed = parseStatsResponse(body);
  if (!parsed) throw new Error("malformed stats response");
  return parsed;
}

export async function fetchVideos(base: string, categoryCode: string, page: number, fetchImpl: FetchLike = fetch, signal?: AbortSignal) {
  const parsed = parseVideosResponse(await getJson(fetchImpl, backendEndpoint(base, "videos", { category: categoryCode, page: String(page) }), { method: "GET" }, signal));
  if (!parsed) throw new Error("malformed videos response");
  return parsed;
}

// ---------------------------------------------------------------------------
// Visitor-added backends (browser storage only, never sent to AppAI)
// ---------------------------------------------------------------------------

export const CUSTOM_BACKENDS_KEY = "appai.videoAsk.customBackends";
export const MAX_CUSTOM_BACKENDS = 5;

export function parseStoredBackends(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter(isHttpsBackendUrl))].slice(0, MAX_CUSTOM_BACKENDS) : [];
  } catch {
    return [];
  }
}

export function normalizeCustomBackend(input: string): string | null {
  const value = input.trim().replace(/\/+$/, "");
  return isHttpsBackendUrl(value) ? value : null;
}
