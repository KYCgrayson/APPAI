"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createIframeSessionRenewal } from "./iframe-session-renewal";

/**
 * Keeps an embedded tool's `appai_session` alive.
 *
 * The first token rides on the iframe URL, so the tool has an identity in its
 * very first request. Every later one arrives by `postMessage`: changing `src`
 * would reload the frame and throw away whatever the visitor was in the middle
 * of, which for a tool that runs long jobs is the whole reason it needed an
 * identity in the first place.
 *
 *   → { type: "appai:session", token, expiresAt }   AppAI, on renewal
 *   ← { type: "appai:session-request" }             the tool, to be told now
 *
 * Returns the token to put on the URL, frozen at mount.
 */

/** Identity handed down by the server render, plus what it takes to renew it. */
export interface IframeToolIdentity {
  token: string;
  /** ISO timestamp. */
  expiresAt: string;
  pageId: string;
  section: number;
}

/** Leave this much of the token's life unspent when reissuing. */
const REFRESH_SLACK_MS = 30_000;
const MIN_REFRESH_DELAY_MS = 30_000;

export function useIframeToolSession(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  trustedOrigin: string | null,
  identity: IframeToolIdentity | null,
): string | null {
  // Frozen at mount: the URL must not change once the frame has loaded.
  const [initialToken] = useState(identity?.token ?? null);
  const [grant, setGrant] = useState(
    identity ? { token: identity.token, expiresAt: identity.expiresAt } : null,
  );
  const grantRef = useRef(grant);
  useEffect(() => {
    grantRef.current = grant;
  }, [grant]);

  const pageId = identity?.pageId ?? null;
  const section = identity?.section ?? null;

  const postSession = useCallback(
    (next: { token: string; expiresAt: string }) => {
      if (!trustedOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "appai:session", token: next.token, expiresAt: next.expiresAt },
        trustedOrigin,
      );
    },
    [iframeRef, trustedOrigin],
  );

  // A tool that missed the URL parameter, or came back from its own soft
  // reload, can just ask instead of reloading the frame.
  useEffect(() => {
    if (!trustedOrigin) return;
    function handleMessage(event: MessageEvent) {
      if (event.origin !== trustedOrigin || event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data as { type?: string } | null;
      if (!msg || typeof msg !== "object" || msg.type !== "appai:session-request") return;
      const current = grantRef.current;
      if (current) postSession(current);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [trustedOrigin, postSession, iframeRef]);

  // Focus, visibility and expiry all share one renewal queue for this frame.
  useEffect(() => {
    if (!pageId || section === null || !trustedOrigin) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = new Date(grantRef.current?.expiresAt ?? "").getTime() - Date.now();
      if (!Number.isFinite(remaining)) return;
      clearTimeout(timer);
      timer = setTimeout(onReturn, Math.max(MIN_REFRESH_DELAY_MS, Math.min(remaining - REFRESH_SLACK_MS, remaining * 0.8)));
    };
    const renew = createIframeSessionRenewal(async () => {
      if (cancelled) return;
      try {
        const response = await fetch("/api/v1/tools/sessions/issue", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId, section }),
        });
        if (!response.ok) return;
        const next = await response.json() as { token?: string; expiresAt?: string };
        if (cancelled || !next.token || !next.expiresAt) return;
        const updated = { token: next.token, expiresAt: next.expiresAt };
        grantRef.current = updated;
        setGrant(updated);
        postSession(updated);
      } catch { /* Retry on the next renewal or return to the page. */ }
      finally { if (!cancelled) schedule(); }
    });
    function onReturn() {
      if (document.visibilityState !== "hidden") void renew();
      else schedule();
    }
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("next-auth");
    const onAuth = (event: MessageEvent) => {
      if (event.data?.event === "session") void renew(true);
    };
    channel?.addEventListener("message", onAuth);
    const onLoad = () => { if (grantRef.current) postSession(grantRef.current); };
    const frame = iframeRef.current;
    frame?.addEventListener("load", onLoad);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    schedule();
    return () => {
      cancelled = true;
      frame?.removeEventListener("load", onLoad);
      clearTimeout(timer);
      channel?.close();
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [pageId, section, trustedOrigin, iframeRef, postSession]);

  return initialToken;
}
