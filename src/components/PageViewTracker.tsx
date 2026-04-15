"use client";

import { useEffect } from "react";

interface Props {
  pageId: string;
  slug: string;
  locale: string;
  orgId: string;
}

export function PageViewTracker({ pageId, slug, locale, orgId }: Props) {
  useEffect(() => {
    const payload = JSON.stringify({
      pageId,
      slug,
      locale,
      orgId,
      referrer: document.referrer || null,
    });

    const url = "/api/p/track/view";

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
    } catch {
      // fall through to fetch
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pageId, slug, locale, orgId]);

  return null;
}
