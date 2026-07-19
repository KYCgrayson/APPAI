"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  itemCode: string;
  canonicalName: string;
  material: string | null;
  dimensionMode: "NONE" | "OPTIONAL" | "REQUIRED";
  length: string | null;
  width: string | null;
  thickness: string | null;
  dimensionUnit: string | null;
  defaultUnit: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  category: { name: string } | null;
  aliases: Array<{ alias: string }>;
  units: Array<{ unitCode: string; label: string; isDefault: boolean }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "操作失敗");
  return body;
}

const emptyForm = {
  itemCode: "",
  canonicalName: "",
  categoryName: "",
  material: "",
  defaultUnit: "支",
  aliases: "",
  dimensionMode: "NONE" as Item["dimensionMode"],
  length: "",
  width: "",
  thickness: "",
  dimensionUnit: "mm",
};

export function ItemManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (search = "") => {
    const params = new URLSearchParams({ q: search, limit: "100" });
    const body = await api<{ items: Item[] }>(`/api/apps/simpleshop/items?${params}`);
    setItems(body.items);
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "讀取失敗"));
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const dimensions = form.dimensionMode === "NONE" ? {} : {
        length: form.length ? Number(form.length) : null,
        width: form.width ? Number(form.width) : null,
        thickness: form.thickness ? Number(form.thickness) : null,
        dimensionUnit: form.dimensionUnit,
      };
      await api("/api/apps/simpleshop/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode: form.itemCode,
          canonicalName: form.canonicalName,
          categoryName: form.categoryName,
          material: form.material,
          defaultUnit: form.defaultUnit,
          dimensionMode: form.dimensionMode,
          ...dimensions,
          aliases: form.aliases.split(",").map((value) => value.trim()).filter(Boolean),
          units: [],
        }),
      });
      setForm(emptyForm);
      await load(query);
      setMessage("品項、別名與預設單位已建立");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(item: Item, status: Item["status"]) {
    setBusy(true);
    try {
      await api(`/api/apps/simpleshop/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load(query);
      setMessage(status === "ACTIVE" ? "品項已啟用" : "品項已停用（歷史資料保留）");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
      <form onSubmit={create} className="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-white">新增品項</h2>
        <p className="mt-1 text-sm text-slate-500">料號永久歸屬目前店家；別名可供出貨時快速搜尋。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">料號<input required value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400">預設單位<input required value={form.defaultUnit} onChange={(event) => setForm({ ...form, defaultUnit: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400 sm:col-span-2">品名<input required value={form.canonicalName} onChange={(event) => setForm({ ...form, canonicalName: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400">分類<input value={form.categoryName} onChange={(event) => setForm({ ...form, categoryName: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400">材質<input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400 sm:col-span-2">別名（逗號分隔）<input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} className={inputClass} /></label>
          <label className="text-xs text-slate-400">尺寸模式<select value={form.dimensionMode} onChange={(event) => setForm({ ...form, dimensionMode: event.target.value as Item["dimensionMode"] })} className={inputClass}><option value="NONE">無尺寸</option><option value="OPTIONAL">可選尺寸</option><option value="REQUIRED">必填尺寸</option></select></label>
          {form.dimensionMode !== "NONE" ? <>
            <label className="text-xs text-slate-400">尺寸單位<input required value={form.dimensionUnit} onChange={(event) => setForm({ ...form, dimensionUnit: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">長<input required={form.dimensionMode === "REQUIRED"} type="number" min="0" step="0.0001" value={form.length} onChange={(event) => setForm({ ...form, length: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">寬<input required={form.dimensionMode === "REQUIRED"} type="number" min="0" step="0.0001" value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">厚<input required={form.dimensionMode === "REQUIRED"} type="number" min="0" step="0.0001" value={form.thickness} onChange={(event) => setForm({ ...form, thickness: event.target.value })} className={inputClass} /></label>
          </> : null}
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">建立品項</button>
        {message ? <p role="status" className="mt-3 text-sm text-slate-300">{message}</p> : null}
      </form>

      <section className="space-y-4">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(query).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "搜尋失敗")); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋料號、品名、材質或別名" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <button className="rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-300">搜尋</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.length === 0 ? <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400 md:col-span-2">尚無品項，請建立第一筆正式料號。</p> : null}
          {items.map((item) => {
            const dimension = item.dimensionMode === "NONE" ? "無尺寸" : [item.length, item.width, item.thickness].filter(Boolean).join(" × ") + ` ${item.dimensionUnit || ""}`;
            return (
              <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold text-emerald-400">{item.itemCode}</p><h2 className="mt-1 font-semibold text-white">{item.canonicalName}</h2></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${item.status === "ACTIVE" ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{item.status}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-500">分類</dt><dd className="mt-1 text-slate-300">{item.category?.name || "未分類"}</dd></div><div><dt className="text-slate-500">單位</dt><dd className="mt-1 text-slate-300">{item.defaultUnit}</dd></div><div><dt className="text-slate-500">材質</dt><dd className="mt-1 text-slate-300">{item.material || "—"}</dd></div><div><dt className="text-slate-500">尺寸</dt><dd className="mt-1 text-slate-300">{dimension}</dd></div></dl>
                {item.aliases.length ? <p className="mt-4 text-xs text-slate-500">別名：{item.aliases.map((alias) => alias.alias).join("、")}</p> : null}
                <button disabled={busy} type="button" onClick={() => void setStatus(item, item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")} className="mt-4 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500">{item.status === "ACTIVE" ? "停用品項" : "啟用品項"}</button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
