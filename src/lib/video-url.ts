/** Only platform-built provider embeds may reach an iframe. No network lookup. */
export type VideoUrl =
  | { kind: "youtube"; id: string; url: string }
  | { kind: "vimeo"; id: string; hash?: string; url: string }
  | { kind: "file" | "gif"; url: string };

export const VIDEO_URL_HINT = "Use a YouTube watch, live, Shorts, embed or youtu.be URL with an 11-character ID, a Vimeo numeric video URL, or an HTTPS .mp4, .webm or .gif URL.";

/** The legacy renderer is only available to safe HTTP(S) URLs. */
export function isSafeLegacyVideoUrl(value: unknown): value is string {
  if (typeof value !== "string" || /[<>\u0000-\u0020\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return false;
    const provider = /(?:^|\.)(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)$/;
    return !/(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)/i.test(url.hostname) || provider.test(url.hostname);
  } catch { return false; }
}

export function parseVideoUrl(value: unknown): VideoUrl | null {
  if (!isSafeLegacyVideoUrl(value)) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname;
  const path = url.pathname;
  let id: string | undefined;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (path === "/watch") id = url.searchParams.get("v") ?? undefined;
    else id = path.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1];
  } else if (host === "youtu.be") id = path.match(/^\/([^/]+)\/?$/)?.[1];
  else if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) id = path.match(/^\/embed\/([^/]+)\/?$/)?.[1];
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` };
  // Recognized provider hosts with malformed IDs must never become file URLs.
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) return null;
  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    const match = path.match(host === "vimeo.com" ? /^\/(\d+)(?:\/([A-Za-z0-9]+))?\/?$/ : /^\/video\/(\d+)\/?$/);
    if (!match) return null;
    const hash = url.searchParams.get("h") ?? match[2];
    if (hash !== undefined && !/^[A-Za-z0-9]+$/.test(hash)) return null;
    return { kind: "vimeo", id: match[1], ...(hash ? { hash } : {}), url: `https://vimeo.com/${match[1]}${hash ? `/${hash}` : ""}` };
  }
  // Do not let a deceptive provider hostname bypass rejection via a media suffix.
  if (/(?:^|\.)(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)\./.test(host)) return null;
  if (url.protocol !== "https:") return null;
  if (/\.(mp4|webm)$/i.test(path)) return { kind: "file", url: url.href };
  if (/\.gif$/i.test(path)) return { kind: "gif", url: url.href };
  return null;
}

export function videoEmbedUrl(video: VideoUrl, origin?: string, start = 0): string | undefined {
  if (video.kind === "youtube") {
    const url = new URL(`https://www.youtube-nocookie.com/embed/${video.id}`);
    if (origin) {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("origin", origin);
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("start", String(start));
    }
    return url.href;
  }
  if (video.kind === "vimeo") {
    const url = new URL(`https://player.vimeo.com/video/${video.id}`);
    if (video.hash) url.searchParams.set("h", video.hash);
    if (origin) { url.searchParams.set("dnt", "1"); url.hash = `t=${start}s`; }
    return url.href;
  }
}

export function videoTimeLink(video: VideoUrl, t: number): string {
  const url = new URL(video.url);
  if (video.kind === "youtube") url.searchParams.set("t", `${t}s`);
  else url.hash = video.kind === "vimeo" ? `t=${t}s` : `t=${t}`;
  return url.href;
}

export function youtubeThumbnail(video: VideoUrl): string | undefined {
  return video.kind === "youtube" ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : undefined;
}
