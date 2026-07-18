"use client";

import { useState } from "react";
import type { SimpleshopSettings } from "@/lib/simpleshop/settings-schema";

export function SettingsForm({ initialSettings }: { initialSettings: SimpleshopSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    try {
      const response = await fetch("/api/apps/simpleshop/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = (await response.json()) as { settings: SimpleshopSettings };
      setSettings(body.settings);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500";
  return (
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm text-slate-300">
          店家名稱
          <input
            value={settings.shopName}
            onChange={(event) => setSettings({ ...settings, shopName: event.target.value })}
            className={inputClass}
            required
          />
        </label>
        <label className="text-sm text-slate-300">
          時區
          <input
            value={settings.timezone}
            onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
            className={inputClass}
            required
          />
        </label>
        <label className="text-sm text-slate-300">
          幣別
          <input
            value={settings.currency}
            onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })}
            maxLength={3}
            className={inputClass}
            required
          />
        </label>
        <label className="text-sm text-slate-300">
          列印抬頭
          <input
            value={settings.print.displayName}
            onChange={(event) => setSettings({ ...settings, print: { ...settings.print, displayName: event.target.value } })}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-slate-300">
          列印電話
          <input
            value={settings.print.phone}
            onChange={(event) => setSettings({ ...settings, print: { ...settings.print, phone: event.target.value } })}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-slate-300 md:col-span-2">
          列印地址
          <input
            value={settings.print.address}
            onChange={(event) => setSettings({ ...settings, print: { ...settings.print, address: event.target.value } })}
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
        >
          {state === "saving" ? "儲存中…" : "儲存店家設定"}
        </button>
        {state === "saved" ? <span className="text-sm text-emerald-400">已儲存</span> : null}
        {state === "error" ? <span className="text-sm text-red-400">儲存失敗，請稍後再試。</span> : null}
      </div>
    </form>
  );
}
