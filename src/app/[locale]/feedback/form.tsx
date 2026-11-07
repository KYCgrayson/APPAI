"use client";
import { useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";

type Turnstile = { render(container: HTMLElement, options: { sitekey: string }): string; reset(id: string): void };
export function FeedbackForm({ siteKey }: { siteKey?: string }) {
  const t = useTranslations("feedbackForm");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error" | "limited">("idle");
  function turnstile() { return (window as unknown as { turnstile?: Turnstile }).turnstile; }
  function renderWidget() {
    if (widget.current && widgetId.current === null && turnstile()) widgetId.current = turnstile()!.render(widget.current, { sitekey: siteKey! });
  }
  if (state === "success") return <p role="status">{t("success")}</p>;
  const field = "block w-full border rounded p-3 mt-1 bg-transparent";
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const response = await fetch("/api/feedback/web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        contactEmail: form.get("email"), kind: form.get("kind"), message: form.get("message"),
        pageUrl: form.get("pageUrl") || undefined, website: form.get("website"),
        turnstileToken: form.get("cf-turnstile-response") || undefined,
      }) });
      setState(response.ok ? "success" : response.status === 429 ? "limited" : "error");
      if (!response.ok && widgetId.current !== null) turnstile()?.reset(widgetId.current);
    } catch { setState("error"); }
  }}>
    <label className="block">{t("email")}<input className={field} type="email" name="email" required maxLength={254} autoComplete="email" /></label>
    <label className="block">{t("kind")}<select className={field} name="kind">{(["missing_feature", "bug", "docs", "other"] as const).map(kind => <option key={kind} value={kind}>{t(kind)}</option>)}</select></label>
    <label className="block">{t("message")}<textarea className={field} name="message" required minLength={10} maxLength={4000} rows={7} /></label>
    <label className="block">{t("page")}<input className={field} type="url" name="pageUrl" maxLength={2048} /></label>
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {siteKey && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderWidget} /><div ref={widget} /></>}
    <button className="bg-blue-600 text-white rounded px-6 py-3 disabled:opacity-50" disabled={state === "sending"} type="submit">{t(state === "sending" ? "sending" : "send")}</button>
    {(state === "error" || state === "limited") && <p role="alert">{t(state)}</p>}
  </form>;
}
