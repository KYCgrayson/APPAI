import { parseVideoUrl, VIDEO_URL_HINT } from "./video-url.ts";

export const MAX_VIDEO_SECONDS = 86400;
export const VIDEO_TIME_PATTERN = "^(?:0*(?:[0-9]{1,4}|[1-7][0-9]{4}|8[0-5][0-9]{3}|86[0-3][0-9]{2}|86400)|[0-5]?[0-9]:[0-5][0-9]|0*(?:[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]|0*24:00:00)$";
/** Decimal integer seconds, m:ss or h:mm:ss, inclusive of exactly 24h. */
export function parseVideoTime(value: unknown): number | null {
  let seconds: number;
  if (typeof value === "number") seconds = value;
  else if (typeof value === "string" && new RegExp(VIDEO_TIME_PATTERN).test(value)) {
    seconds = value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  } else return null;
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= MAX_VIDEO_SECONDS ? seconds : null;
}

export function formatVideoTime(t: number): string {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** ISO 8601 day/time duration; calendar months/years have no fixed seconds. */
export function videoDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match || !match.slice(1).some(part => part !== undefined) || value.endsWith("T")) return null;
  const t = Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
  return t > 0 && t <= MAX_VIDEO_SECONDS ? t : null;
}

export interface VideoMoment { t: number; title: string; text?: string }
export interface VideoData {
  url: string;
  heading?: string;
  subheading?: string;
  caption?: string;
  moments?: VideoMoment[];
  momentsHeading?: string;
  startAt?: number;
  uploadDate?: string;
  duration?: string;
  thumbnail?: string;
}
export interface VideoIssue { code: "custom"; path: (string | number)[]; message: string }
export function videoFieldPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => typeof key === "number" ? `${text}[${key}]` : `${text}${text ? "." : ""}${String(key)}`, "");
}

/** Shared by every API write, preview, and defensive rendering. Never mutates input. */
export function normalizeVideoData(value: unknown, path: (string | number)[] = [], partial = false) {
  const issues: VideoIssue[] = [];
  const fail = (field: (string | number)[], message: string) => {
    const location = [...path, ...field];
    issues.push({ code: "custom", path: location, message: `${videoFieldPath(location)}: ${message}` });
  };
  const data: Record<string, unknown> = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  if ((!partial || data.url !== undefined) && !parseVideoUrl(data.url)) fail(["url"], VIDEO_URL_HINT);
  if (data.momentsHeading !== undefined && (typeof data.momentsHeading !== "string" || data.momentsHeading.length > 60)) fail(["momentsHeading"], "must be a string of at most 60 characters");
  if (data.startAt !== undefined) {
    const t = parseVideoTime(data.startAt);
    if (t === null) fail(["startAt"], "use integer seconds, m:ss or h:mm:ss between 0 and 24h");
    else data.startAt = t;
  }
  if (data.moments !== undefined) {
    if (!Array.isArray(data.moments)) fail(["moments"], "must be an array (max 100)");
    else {
      if (data.moments.length > 100) fail(["moments"], "must contain at most 100 moments");
      const duration = videoDurationSeconds(data.duration);
      const seen = new Set<number>();
      const moments: VideoMoment[] = [];
      data.moments.forEach((moment, index) => {
        const base = ["moments", index];
        if (!moment || typeof moment !== "object" || Array.isArray(moment)) { fail(base, "must be {t, title, text?}"); return; }
        const t = parseVideoTime(moment.t);
        if (duration !== null && t !== null && t >= duration) fail([...base, "t"], "must be before duration");
        if (t === null) fail([...base, "t"], "use integer seconds, m:ss or h:mm:ss between 0 and 24h");
        if (typeof moment.title !== "string" || !moment.title.trim() || moment.title.length > 120) fail([...base, "title"], "must be a nonempty string of at most 120 characters");
        if (moment.text !== undefined && (typeof moment.text !== "string" || moment.text.length > 600)) fail([...base, "text"], "must be a string of at most 600 characters");
        if (t !== null && !seen.has(t)) {
          seen.add(t);
          moments.push({ t, title: moment.title, ...(moment.text !== undefined ? { text: moment.text } : {}) });
        }
      });
      data.moments = moments.sort((a, b) => a.t - b.t);
    }
  }
  if (data.uploadDate !== undefined) {
    const date = data.uploadDate;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date.slice(0, 10)).toISOString().slice(0, 10) !== date.slice(0, 10)) fail(["uploadDate"], "must be an ISO 8601 date or timestamp with timezone");
  }
  const duration = videoDurationSeconds(data.duration);
  if (data.duration !== undefined && duration === null) fail(["duration"], "must be a positive ISO 8601 day/time duration of at most 24h (e.g. PT5M30S)");
  if (duration !== null && typeof data.startAt === "number" && data.startAt >= duration) fail(["startAt"], "must be before duration");
  if (data.thumbnail !== undefined) {
    let valid = false;
    try { const url = new URL(data.thumbnail as string); valid = typeof data.thumbnail === "string" && url.protocol === "https:" && !url.username && !url.password && !url.port; } catch { /* invalid */ }
    if (!valid) fail(["thumbnail"], "must be an HTTPS image URL without credentials or a non-default port");
  }
  if (parseVideoUrl(data.url)?.kind === "gif" && (data.moments !== undefined || data.startAt !== undefined)) fail(["url"], "GIF images cannot seek; use .mp4/.webm or a provider video for moments/startAt");
  return { data: data as unknown as VideoData, issues };
}

export function normalizeVideoContent(value: unknown, partial = false) {
  const content = value as { sections?: unknown } | null;
  const issues: VideoIssue[] = [];
  if (!Array.isArray(content?.sections)) return { content: value, issues };
  const sections = content.sections.map((section, i) => {
    if (section?.type !== "video") return section;
    const result = normalizeVideoData(section.data, ["sections", i, "data"], partial);
    issues.push(...result.issues);
    return { ...section, data: result.data };
  });
  return { content: { ...content, sections }, issues };
}
