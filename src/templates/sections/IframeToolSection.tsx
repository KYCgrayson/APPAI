"use client";

import { useEffect, useRef, useState } from "react";
import { checkIframeToolUrl } from "@/lib/iframe-tool-allowlist";

interface Props {
  data: {
    heading?: string;
    description?: string;
    features?: string[];
    src?: string;
    initialHeight?: number;
    allowFullscreen?: boolean;
  };
  themeColor: string;
  darkMode?: boolean;
  locale?: string;
  /** Optional standalone URL to surface as a "Open fullscreen" affordance. */
  fullscreenHref?: string;
}

const DEFAULT_HEIGHT = 600;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 4000;

function buildIframeSrc(rawSrc: string, opts: { locale: string; themeColor: string; darkMode: boolean }): string {
  const url = new URL(rawSrc);
  url.searchParams.set("locale", opts.locale);
  url.searchParams.set("color", opts.themeColor);
  if (opts.darkMode) url.searchParams.set("theme", "dark");
  return url.toString();
}

export function IframeToolSection({
  data,
  themeColor,
  darkMode = false,
  locale = "en",
  fullscreenHref,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(
    Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, data.initialHeight ?? DEFAULT_HEIGHT)),
  );
  const [loaded, setLoaded] = useState(false);

  const check = data.src ? checkIframeToolUrl(data.src) : { ok: false, reason: "Missing src" };

  const trustedOrigin = check.ok && check.url ? check.url.origin : null;
  useEffect(() => {
    if (!trustedOrigin) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== trustedOrigin) return;
      if (!event.data || typeof event.data !== "object") return;
      const msg = event.data as { type?: string; height?: number };
      if (msg.type === "ready") {
        setLoaded(true);
        return;
      }
      if (msg.type === "resize" && typeof msg.height === "number") {
        const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(msg.height)));
        setHeight(clamped);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [trustedOrigin]);

  const finalSrc = check.ok && check.url
    ? buildIframeSrc(data.src!, { locale, themeColor, darkMode })
    : null;

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {(data.heading || data.description) && (
          <div className="text-center mb-8 md:mb-10">
            {data.heading && (
              <h2
                className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3"
                style={{ color: themeColor }}
              >
                {data.heading}
              </h2>
            )}
            {data.description && (
              <p
                className={`text-base md:text-lg max-w-2xl mx-auto ${darkMode ? "text-gray-300" : "text-gray-600"}`}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        {data.features && data.features.length > 0 && (
          <ul className={`max-w-2xl mx-auto mb-8 grid gap-2 sm:grid-cols-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            {data.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: themeColor }}
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        {finalSrc ? (
          <div
            className={`relative rounded-2xl overflow-hidden border ${darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"} shadow-sm`}
          >
            {!loaded && (
              <div
                className={`absolute inset-0 flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}
                aria-hidden="true"
              >
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: `${themeColor} transparent ${themeColor} ${themeColor}` }}
                />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={finalSrc}
              title={data.heading || "Embedded tool"}
              loading="lazy"
              allow={data.allowFullscreen === false ? undefined : "fullscreen; clipboard-write; gamepad; accelerometer; gyroscope"}
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ width: "100%", height: `${height}px`, border: 0, display: "block" }}
              onLoad={() => {
                setTimeout(() => setLoaded(true), 1500);
              }}
            />
            {fullscreenHref && (
              <div className="flex justify-end px-3 py-2 border-t" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
                <a
                  href={fullscreenHref}
                  className="text-xs font-medium hover:underline"
                  style={{ color: themeColor }}
                >
                  Open fullscreen →
                </a>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`rounded-2xl border-2 border-dashed p-8 text-center ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}
          >
            <p className="font-medium mb-1">Tool unavailable</p>
            <p className="text-sm">{check.reason}</p>
          </div>
        )}
      </div>
    </section>
  );
}
