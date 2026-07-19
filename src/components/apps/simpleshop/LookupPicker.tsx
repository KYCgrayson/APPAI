"use client";

import { useState } from "react";
import type { LookupKind, LookupResponse, LookupResult } from "@/lib/simpleshop/lookups";

const LABELS: Record<LookupKind, string> = {
  customer: "客戶",
  "job-site": "工地",
  item: "品項",
};

export function LookupPicker({
  kind,
  disabled = false,
  disabledReason,
  customerId,
  onSelect,
}: {
  kind: LookupKind;
  disabled?: boolean;
  disabledReason?: string;
  customerId?: string;
  onSelect?: (item: LookupResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "loaded"; response: LookupResponse }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function search() {
    setState({ kind: "loading" });
    try {
      const params = new URLSearchParams({ kind, q: query, limit: "20" });
      if (kind === "job-site" && customerId) params.set("customerId", customerId);
      const response = await fetch(`/api/apps/simpleshop/lookups?${params}`, {
        credentials: "same-origin",
      });
      const body = (await response.json()) as LookupResponse & { message?: string };
      if (!response.ok) throw new Error(body.message || "查詢失敗");
      setState({ kind: "loaded", response: body });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "查詢失敗",
      });
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        查詢{LABELS[kind]}
        {disabled && disabledReason ? (
          <span className="mt-1 block text-xs text-slate-500">{disabledReason}</span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${LABELS[kind]}查詢`}
            className="w-full max-w-xl rounded-t-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">查詢{LABELS[kind]}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                關閉
              </button>
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`輸入${LABELS[kind]}名稱或關鍵字`}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                搜尋
              </button>
            </form>

            <div className="mt-4 min-h-40 rounded-xl border border-dashed border-slate-800 p-4">
              {state.kind === "idle" ? <p className="text-sm text-slate-500">輸入條件後開始查詢。</p> : null}
              {state.kind === "loading" ? <p className="text-sm text-slate-400">查詢中…</p> : null}
              {state.kind === "error" ? <p className="text-sm text-red-400">{state.message}</p> : null}
              {state.kind === "loaded" && state.response.items.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-medium text-slate-300">目前沒有可選資料</p>
                  <p className="mt-2 text-sm text-slate-500">{state.response.message}</p>
                </div>
              ) : null}
              {state.kind === "loaded" && state.response.items.length > 0 ? (
                <div className="space-y-2">
                  {state.response.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelect?.(item);
                        setOpen(false);
                      }}
                      className="w-full rounded-lg border border-slate-800 p-3 text-left text-sm text-slate-200 hover:border-cyan-500"
                    >
                      {"name" in item ? item.name : item.canonicalName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
