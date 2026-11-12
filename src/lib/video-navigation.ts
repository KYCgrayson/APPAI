import { parseVideoTime } from "./video-data.ts";

/** Match navigation within this document, never another origin/path/query. */
export function samePageVideoTime(href: string, current: string): { t: number; id: string; url: URL } | null {
  try {
    if (!href.includes("?")) return null;
    const base = new URL(current);
    const url = new URL(href, base);
    if (url.origin !== base.origin || url.pathname !== base.pathname || !url.searchParams.has("t")) return null;
    const other = (input: URL) => {
      const params = new URLSearchParams(input.search);
      params.delete("t"); params.sort(); return params.toString();
    };
    // A bare ?t= link intentionally replaces the query; populated queries must match.
    if (other(url) && other(url) !== other(base)) return null;
    const t = parseVideoTime(url.searchParams.get("t"));
    if (t === null) return null;
    return { t, id: decodeURIComponent(url.hash.slice(1)), url };
  } catch { return null; }
}

interface Entry { element: HTMLElement; id: string; initial: number; seek: (t: number, userAction: boolean) => void }
const entries = new Set<Entry>();
let detach: (() => void) | undefined;
let scheduled = false;
function ordered() { return [...entries].sort((a, b) => a.element.compareDocumentPosition(b.element) & 4 ? -1 : 1); }
function target(id: string) { const all = ordered(); return all.find(entry => entry.id === id) ?? all[0]; }

/** One delegated listener for Markdown/share links, with per-player lifecycle cleanup. */
export function registerVideoNavigation(entry: Entry): () => void {
  entries.add(entry);
  if (!detach) {
    const navigate = () => {
      const parsed = samePageVideoTime(window.location.href, window.location.href);
      for (const video of entries) video.seek(video === target(parsed?.id ?? "") && parsed ? parsed.t : video.initial, false);
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const parsed = samePageVideoTime(anchor.getAttribute("href") || anchor.href, window.location.href);
      const video = parsed && target(parsed.id);
      if (!parsed || !video) return;
      event.preventDefault();
      window.history.pushState(null, "", parsed.url);
      video.seek(parsed.t, true);
      video.element.scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("click", click);
    window.addEventListener("popstate", navigate);
    window.addEventListener("hashchange", navigate);
    detach = () => {
      document.removeEventListener("click", click);
      window.removeEventListener("popstate", navigate);
      window.removeEventListener("hashchange", navigate);
    };
  }
  // Hydration can register several players in the same turn. Resolve #id after all register.
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const parsed = samePageVideoTime(window.location.href, window.location.href);
      if (parsed) target(parsed.id)?.seek(parsed.t, false);
    });
  }
  return () => { entries.delete(entry); if (!entries.size) { detach?.(); detach = undefined; } };
}
