"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  CUSTOM_BACKENDS_KEY,
  VIDEO_ASK_ALLOW_DIRECT_BACKENDS,
  answerLang,
  pickSummary,
  pickUiLang,
  MAX_CUSTOM_BACKENDS,
  categoryLabel,
  configuredBackendBase,
  fetchSearch,
  fetchStats,
  fetchVideos,
  normalizeCustomBackend,
  parseStoredBackends,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  type VideoAskItem,
  type VideoAskMode,
  type VideoAskStats,
  type VideoAskUiLang,
} from "@/lib/video-ask";
import { fill, videoAskStrings, type VideoAskStrings } from "./video-ask-strings";

interface Props {
  data: {
    heading?: string;
    subheading?: string;
    intro?: string;
    mode?: VideoAskMode;
    connector?: string;
    backendUrl?: string;
    allowCustomBackend?: boolean;
    placeholder?: string;
    disclaimer?: string;
  };
  themeColor: string;
  darkMode?: boolean;
  locale?: string;
  typographyActive?: boolean;
}

type StatsState = { status: "loading" } | { status: "ok"; data: VideoAskStats } | { status: "absent" } | { status: "error" };
type View =
  | { kind: "home" }
  | { kind: "results"; query: string; items: VideoAskItem[]; lang: VideoAskUiLang }
  | { kind: "category"; code: string; label: string; items: VideoAskItem[]; page: number; hasMore: boolean };

const noopSubscribe = () => () => {};

function browserLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : [];
}

function readStorage(key: string, session = false): string | null {
  try {
    return (session ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, session = false) {
  try {
    (session ? window.sessionStorage : window.localStorage).setItem(key, value);
  } catch {
    /* private mode: keep in memory only */
  }
}

export function VideoAskSection({ data, themeColor, darkMode = false, locale = "en", typographyActive = false }: Props) {
  // UI language: page locale if supported, else the browser's (client only, so
  // the first render matches the server), else en as a switchable fallback.
  const browserLangs = useSyncExternalStore(noopSubscribe, () => browserLanguages().join(","), () => "");
  const picked = pickUiLang(locale, browserLangs ? browserLangs.split(",") : []);
  // A question in another script may switch the UI only while it is on the en fallback.
  const [answerOverride, setAnswerOverride] = useState<VideoAskUiLang | null>(null);
  const ui = picked.fallback && answerOverride ? { lang: answerOverride, fallback: true } : picked;
  const t = videoAskStrings(ui.lang);
  const mode: VideoAskMode = data.mode === "inline" ? "inline" : "floating";
  const [open, setOpen] = useState(mode === "inline");
  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode !== "floating" || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, open]);

  const panel = (
    <AskPanel
      data={data}
      t={t}
      uiLang={ui.lang}
      onAnswerLang={lang => { if (picked.fallback) setAnswerOverride(lang); }}
      themeColor={themeColor}
      darkMode={darkMode}
      typographyActive={typographyActive}
      active={open}
      floating={mode === "floating"}
      onClose={mode === "floating" ? () => { setOpen(false); launcherRef.current?.focus(); } : undefined}
    />
  );

  if (mode === "inline") {
    return (
      <section className={`px-4 py-10 sm:py-14 ${darkMode ? "text-gray-100" : "text-gray-900"}`} data-video-ask="inline">
        <div className="mx-auto max-w-3xl">
          {data.heading && (
            <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-2xl sm:text-3xl font-bold mb-2 text-center">{data.heading}</h2>
          )}
          {data.subheading && (
            <p data-typography-role={typographyActive ? "body" : undefined} className={`text-center mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{data.subheading}</p>
          )}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
            {panel}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div data-video-ask="floating">
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className={`fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 rounded-full px-5 py-3 text-white font-semibold shadow-lg transition-opacity focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 ${open ? "max-sm:opacity-0 max-sm:pointer-events-none" : ""}`}
        style={{ backgroundColor: themeColor }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {t.launcher}
      </button>
      <div
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-label={data.heading || t.title}
        aria-hidden={!open}
        inert={!open}
        className={`fixed z-50 flex flex-col shadow-2xl border transition-transform duration-300 ease-out
          inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl
          sm:inset-x-auto sm:right-6 sm:bottom-24 sm:h-auto sm:max-h-[min(640px,calc(100dvh-8rem))] sm:w-[420px] sm:rounded-2xl
          ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900"}
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-[calc(100%+2rem)]"}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-inherit">
          <div className="sm:hidden absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-400/50" aria-hidden="true" />
          <h2 data-typography-role={typographyActive ? "card" : undefined} className="font-semibold text-base truncate pt-1">{data.heading || t.title}</h2>
          <button
            type="button"
            onClick={() => { setOpen(false); launcherRef.current?.focus(); }}
            aria-label={t.collapse}
            className={`shrink-0 rounded-full p-2 ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{panel}</div>
      </div>
    </div>
  );
}

function AskPanel({ data, t, uiLang, onAnswerLang, themeColor, darkMode, typographyActive, active, floating }: {
  data: Props["data"];
  t: VideoAskStrings;
  uiLang: VideoAskUiLang;
  onAnswerLang: (lang: VideoAskUiLang) => void;
  themeColor: string;
  darkMode: boolean;
  typographyActive: boolean;
  active: boolean;
  floating: boolean;
  onClose?: () => void;
}) {
  const configured = configuredBackendBase(data);
  // Visitor-added backends are browser-direct: off unless the owner enables them.
  const customAllowed = VIDEO_ASK_ALLOW_DIRECT_BACKENDS && data.allowCustomBackend === true;
  const sessionKey = `appai.videoAsk.selected:${configured ?? ""}`;
  const [customBackends, setCustomBackends] = useState<string[]>([]);
  const [base, setBase] = useState<string | null>(configured);
  const [stats, setStats] = useState<StatsState>({ status: "loading" });
  const [view, setView] = useState<View>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [addError, setAddError] = useState(false);
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const inputId = useId();
  const muted = darkMode ? "text-gray-400" : "text-gray-600";
  const chip = darkMode ? "border-gray-700 bg-gray-800 hover:bg-gray-700" : "border-gray-200 bg-gray-50 hover:bg-gray-100";

  // Visitor-added backends come from this browser only.
  useEffect(() => {
    if (!customAllowed) return;
    const stored = parseStoredBackends(readStorage(CUSTOM_BACKENDS_KEY));
    setCustomBackends(stored);
    const selected = readStorage(sessionKey, true);
    if (selected && stored.includes(selected)) setBase(selected);
  }, [customAllowed, sessionKey]);

  const loadStats = useCallback(async (target: string | null) => {
    abort.current?.abort();
    if (!target) {
      setStats({ status: "absent" });
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStats({ status: "loading" });
    try {
      const result = await fetchStats(target, fetch, controller.signal);
      if (!controller.signal.aborted) setStats(result ? { status: "ok", data: result } : { status: "absent" });
    } catch {
      // Dead/unhealthy backend (network, 5xx, timeout, malformed): say so up
      // front instead of opening a blank panel. A 404 is "no stats" above.
      if (!controller.signal.aborted) setStats({ status: "error" });
    }
  }, []);

  // Floating panels stay idle until first opened; inline loads right away.
  useEffect(() => {
    if (!active && !started.current) return;
    started.current = true;
    setView({ kind: "home" });
    setPaused(false);
    setPlaying(null);
    void loadStats(base);
  }, [active, base, loadStats]);

  useEffect(() => () => abort.current?.abort(), []);

  const run = async (work: (target: string, signal: AbortSignal) => Promise<void>) => {
    if (!base) {
      setPaused(true);
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setPaused(false);
    try {
      await work(base, controller.signal);
    } catch {
      if (!controller.signal.aborted) setPaused(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const ask = (event?: React.FormEvent) => {
    event?.preventDefault();
    const q = query.trim().slice(0, 300);
    if (!q || busy) return;
    void run(async (target, signal) => {
      // The question's script picks the answer language (kana → ja, Han → zh,
      // Hangul → en for now, Latin → UI language); the backend ranks by it.
      const lang = answerLang(uiLang, q, browserLanguages());
      const result = await fetchSearch(target, q, lang, fetch, signal);
      if (signal.aborted) return;
      setPlaying(null);
      setView({ kind: "results", query: q, items: result.results, lang });
      onAnswerLang(lang);
    });
  };

  const openCategory = (code: string, labelText: string, page = 1) => {
    void run(async (target, signal) => {
      const result = await fetchVideos(target, code, page, fetch, signal);
      if (signal.aborted) return;
      setView(current => ({
        kind: "category",
        code,
        label: labelText,
        items: page > 1 && current.kind === "category" && current.code === code
          ? [...current.items, ...result.results.filter(item => !current.items.some(old => old.videoId === item.videoId))]
          : result.results,
        page: result.page,
        hasMore: result.hasMore,
      }));
      if (page === 1) setPlaying(null);
    });
  };

  const selectBackend = (value: string) => {
    const next = value === "" ? configured : value;
    setBase(next);
    writeStorage(sessionKey, value, true);
  };

  const addBackend = () => {
    const normalized = normalizeCustomBackend(adding);
    if (!normalized) {
      setAddError(true);
      return;
    }
    const next = [normalized, ...customBackends.filter(url => url !== normalized)].slice(0, MAX_CUSTOM_BACKENDS);
    setCustomBackends(next);
    writeStorage(CUSTOM_BACKENDS_KEY, JSON.stringify(next));
    setAdding("");
    setAddError(false);
    selectBackend(normalized);
  };

  const removeBackend = (url: string) => {
    const next = customBackends.filter(item => item !== url);
    setCustomBackends(next);
    writeStorage(CUSTOM_BACKENDS_KEY, JSON.stringify(next));
    if (base === url) selectBackend("");
  };

  const items = view.kind === "home" ? [] : view.items;

  return (
    <div className="p-4 space-y-4">
      {(!floating || view.kind === "home") && (
        <p data-typography-role={typographyActive ? "body" : undefined} className={`text-sm ${muted}`}>{data.intro || t.intro}</p>
      )}

      {customAllowed && (
        <details className={`rounded-lg border text-sm ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
          <summary className="cursor-pointer select-none px-3 py-2 font-medium">
            {t.whereToAsk}: <span className={muted}>{base === configured ? t.defaultBackend : safeHost(base)}</span>
          </summary>
          <div className="px-3 pb-3 space-y-2">
            <select
              aria-label={t.whereToAsk}
              value={base === configured ? "" : base ?? ""}
              onChange={event => selectBackend(event.target.value)}
              className={`w-full rounded-md border px-2 py-2 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}
            >
              <option value="">{t.defaultBackend}</option>
              {customBackends.map(url => <option key={url} value={url}>{safeHost(url)}</option>)}
            </select>
            {customBackends.length > 0 && (
              <ul className="space-y-1">
                {customBackends.map(url => (
                  <li key={url} className="flex items-center justify-between gap-2">
                    <span className={`truncate text-xs ${muted}`}>{url}</span>
                    <button type="button" onClick={() => removeBackend(url)} className="text-xs underline shrink-0">{t.remove}</button>
                  </li>
                ))}
              </ul>
            )}
            <label className="block text-xs font-medium" htmlFor={`${inputId}-backend`}>{t.addBackend}</label>
            <div className="flex gap-2">
              <input
                id={`${inputId}-backend`}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={adding}
                onChange={event => { setAdding(event.target.value); setAddError(false); }}
                aria-invalid={addError}
                className={`min-w-0 flex-1 rounded-md border px-2 py-2 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"} ${addError ? "border-red-500" : ""}`}
              />
              <button type="button" onClick={addBackend} className="rounded-md px-3 py-2 text-white font-medium" style={{ backgroundColor: themeColor }}>{t.add}</button>
            </div>
            <p className={`text-xs ${addError ? "text-red-500" : muted}`} role={addError ? "alert" : undefined}>{addError ? t.invalidUrl : t.addBackendHint}</p>
          </div>
        </details>
      )}

      <form onSubmit={ask} className="flex gap-2" role="search">
        <label htmlFor={inputId} className="sr-only">{data.placeholder || t.placeholder}</label>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          maxLength={300}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={data.placeholder || t.placeholder}
          className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${darkMode ? "bg-gray-800 border-gray-700 placeholder-gray-500" : "bg-white border-gray-300 placeholder-gray-400"}`}
          style={{ ["--tw-ring-color" as string]: themeColor }}
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="shrink-0 rounded-xl px-4 py-3 text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {busy ? t.asking : t.ask}
        </button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {(paused || (view.kind === "home" && stats.status === "error")) && (
          <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${darkMode ? "border-amber-800 bg-amber-950/40 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <p>{t.paused}</p>
            <button type="button" onClick={() => { setPaused(false); void loadStats(base); }} className="mt-1 underline font-medium">{t.retry}</button>
          </div>
        )}

        {!paused && view.kind === "home" && stats.status === "ok" && (
          <div className="space-y-3">
            {(stats.data.totalVideos !== null || stats.data.indexedVideos !== null) && (
              <p className={`text-sm ${muted}`}>
                {fill(t.stats, {
                  total: (stats.data.totalVideos ?? stats.data.indexedVideos ?? 0).toLocaleString(uiLang),
                  indexed: (stats.data.indexedVideos ?? stats.data.totalVideos ?? 0).toLocaleString(uiLang),
                })}
              </p>
            )}
            {stats.data.categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2">{t.browse}</p>
                <div className="flex flex-wrap gap-2">
                  {stats.data.categories.map(category => {
                    const text = categoryLabel(category.label, uiLang);
                    return (
                      <button
                        key={category.code}
                        type="button"
                        onClick={() => openCategory(category.code, text)}
                        disabled={busy}
                        className={`rounded-full border px-3 py-1.5 text-sm ${chip}`}
                      >
                        {text}{category.count !== null && <span className={`ml-1.5 ${muted}`}>{category.count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {!paused && view.kind === "home" && stats.status === "loading" && active && (
          <p className={`text-sm ${muted}`}>{t.loading}</p>
        )}

        {!paused && view.kind !== "home" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm truncate">{view.kind === "results" ? t.results : view.label}</h3>
              <button type="button" onClick={() => { setView({ kind: "home" }); setPlaying(null); }} className="text-sm underline shrink-0">{t.back}</button>
            </div>
            {items.length === 0 && <p className={`text-sm ${muted}`}>{t.noResults}</p>}
            <ul className="space-y-3">
              {items.map(item => (
                <VideoCard
                  key={item.videoId}
                  item={item}
                  t={t}
                  lang={view.kind === "results" ? view.lang : uiLang}
                  darkMode={darkMode}
                  playing={playing === item.videoId}
                  onPlay={() => setPlaying(item.videoId)}
                />
              ))}
            </ul>
            {view.kind === "category" && view.hasMore && (
              <button
                type="button"
                disabled={busy}
                onClick={() => openCategory(view.code, view.label, view.page + 1)}
                className={`w-full rounded-xl border px-4 py-2 text-sm font-medium ${chip}`}
              >
                {busy ? t.loading : t.loadMore}
              </button>
            )}
          </div>
        )}
      </div>

      {data.disclaimer && <p className={`text-xs ${muted}`}>{data.disclaimer}</p>}
    </div>
  );
}

function VideoCard({ item, t, lang, darkMode, playing, onPlay }: {
  item: VideoAskItem;
  t: VideoAskStrings;
  /** Language for this answer's summary and category label. */
  lang: VideoAskUiLang;
  darkMode: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  const muted = darkMode ? "text-gray-400" : "text-gray-600";
  const canPlay = item.embeddable;
  const summary = pickSummary(item, lang);
  const summaryLang = summary === item.summary ? "en" : summary === item.summaryOriginal ? item.language || undefined : lang;
  return (
    <li className={`rounded-xl border overflow-hidden ${darkMode ? "border-gray-700 bg-gray-800/60" : "border-gray-200 bg-white"}`}>
      {playing && canPlay ? (
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={youtubeEmbedUrl(item.videoId)}
            title={item.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      <div className="flex gap-3 p-3">
        {!(playing && canPlay) && (
          canPlay ? (
            <button type="button" onClick={onPlay} aria-label={fill(t.play, { title: item.title })} className="relative shrink-0 w-32 sm:w-36 aspect-video rounded-lg overflow-hidden bg-gray-200 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors" aria-hidden="true">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </span>
            </button>
          ) : (
            <a href={youtubeWatchUrl(item.videoId)} target="_blank" rel="noopener noreferrer" className="shrink-0 w-32 sm:w-36 aspect-video rounded-lg overflow-hidden bg-gray-200" aria-label={t.watch}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          )
        )}
        <div className="min-w-0 flex-1">
          {canPlay ? (
            <button type="button" onClick={onPlay} className="text-left font-semibold text-sm leading-snug line-clamp-2 hover:underline">{item.title}</button>
          ) : (
            <p className="font-semibold text-sm leading-snug line-clamp-2">{item.title}</p>
          )}
          <p className={`mt-0.5 text-xs truncate ${muted}`}>
            {[item.author, item.category ? categoryLabel(item.category.label, lang) : ""].filter(Boolean).join(" · ")}
          </p>
          {summary && <p lang={summaryLang} className={`mt-1 text-xs line-clamp-2 ${muted}`}>{summary}</p>}
          {!canPlay && <p className={`mt-1 text-xs ${muted}`}>{t.notEmbeddable}</p>}
          <a href={youtubeWatchUrl(item.videoId)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium underline">{t.watch}</a>
        </div>
      </div>
    </li>
  );
}

function safeHost(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
