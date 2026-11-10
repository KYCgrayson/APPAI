"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { GameSectionData } from "@/lib/game-section";
import { gameSectionCopy } from "@/lib/game-section-copy";
import { checkIframeToolUrl } from "@/lib/iframe-tool-allowlist";
import { IframeToolSection } from "./IframeToolSection";
import type { IframeToolIdentity } from "./use-iframe-tool-session";
import { FaqSection } from "../app-landing/sections/FaqSection";

export function GameSection({ data, themeColor, darkMode = false, locale = "en", title = "Game", identity, typographyActive = false }: {
  data: GameSectionData; themeColor: string; darkMode?: boolean; locale?: string; title?: string;
  identity: IframeToolIdentity | null; typographyActive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const source = checkIframeToolUrl(data.gameUrl);
  const { play, close, how, notice } = gameSectionCopy(locale, source.url?.hostname ?? "");
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setExpanded(false); button.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [expanded]);
  const ratio = data.aspectRatio || (data.orientation === "portrait" ? "9:16" : "16:9");
  return <section className="min-w-0 break-words py-8">
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {data.heading && <h2 className="text-2xl font-bold mb-3" style={{ color: themeColor }}>{data.heading}</h2>}
      {data.description && <p data-typography-role={typographyActive ? "body" : undefined} className="mb-6 max-w-3xl">{data.description}</p>}
      {data.cover && <Image unoptimized src={data.cover.url} alt={data.cover.alt} width={data.cover.width || 1200} height={data.cover.height || 630} className="mb-6 max-h-64 w-full rounded-xl object-contain" />}
      <div className={expanded ? "fixed inset-0 z-50 flex flex-col overflow-hidden" : "min-w-0"} style={expanded ? { backgroundColor: darkMode ? "#111827" : "#fff", color: darkMode ? "#f9fafb" : "#111827" } : undefined}>
        <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 py-3">
          {source.ok && <p className="min-w-0 flex-1 basis-48 break-words text-sm" data-typography-role={typographyActive ? "caption" : undefined}>{notice}</p>}
          <button ref={button} type="button" aria-expanded={expanded} className="shrink-0 rounded-lg border-2 px-4 py-3 font-semibold" style={{ borderColor: themeColor, color: themeColor }} onClick={() => setExpanded(!expanded)}>{expanded ? close : play}</button>
        </div>
        <div className={expanded ? "min-h-0 flex-1 overflow-auto" : "min-w-0"}>
          <IframeToolSection variant="game" data={{ src: data.gameUrl, identity: data.identity, aspectRatio: ratio, viewportHeight: expanded }} themeColor={themeColor} darkMode={darkMode} locale={locale} identity={identity} sessionInUrl={false} frameTitle={data.heading || title} />
        </div>
      </div>
      {data.howToPlay?.length > 0 && <div className="mt-8"><h2 className="text-2xl font-bold mb-4">{how}</h2><ol className="list-decimal pl-6 space-y-2">{data.howToPlay.map((step, i) => <li key={i}>{step}</li>)}</ol></div>}
    </div>
    {data.faq?.length ? <FaqSection data={{ items: data.faq }} themeColor={themeColor} darkMode={darkMode} typographyActive={typographyActive} /> : null}
  </section>;
}
