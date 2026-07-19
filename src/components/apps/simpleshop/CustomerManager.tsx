"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = {
  id: string;
  customerCode: number;
  name: string;
  shortName: string | null;
  phone: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE";
  _count?: { jobSites: number; contacts: number };
};

type JobSite = {
  id: string;
  name: string;
  keyword: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: "ACTIVE" | "COMPLETED" | "INACTIVE";
  monthCodes?: Array<{ month: string; monthlyCode: number }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "操作失敗");
  return body;
}

export function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", address: "" });
  const [siteForm, setSiteForm] = useState({ name: "", keyword: "", address: "", contactName: "", contactPhone: "", aliases: "" });

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  const loadCustomers = useCallback(async (search = "") => {
    const params = new URLSearchParams({ q: search, limit: "100" });
    const body = await api<{ customers: Customer[] }>(`/api/apps/simpleshop/customers?${params}`);
    setCustomers(body.customers);
    setSelectedId((current) => current && body.customers.some((customer) => customer.id === current)
      ? current
      : body.customers[0]?.id ?? null);
  }, []);

  const loadJobSites = useCallback(async (customerId: string) => {
    const params = new URLSearchParams({ customerId, limit: "100" });
    const body = await api<{ jobSites: JobSite[] }>(`/api/apps/simpleshop/job-sites?${params}`);
    setJobSites(body.jobSites);
  }, []);

  useEffect(() => {
    void loadCustomers().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "讀取失敗"));
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedId) {
      setJobSites([]);
      return;
    }
    void loadJobSites(selectedId).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "讀取失敗"));
  }, [loadJobSites, selectedId]);

  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const body = await api<{ customer: Customer }>("/api/apps/simpleshop/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      });
      setCustomerForm({ name: "", phone: "", address: "" });
      await loadCustomers(query);
      setSelectedId(body.customer.id);
      setMessage(`已建立客戶 #${String(body.customer.customerCode).padStart(4, "0")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function createJobSite(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/api/apps/simpleshop/job-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedId,
          ...siteForm,
          aliases: siteForm.aliases.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      setSiteForm({ name: "", keyword: "", address: "", contactName: "", contactPhone: "", aliases: "" });
      await Promise.all([loadJobSites(selectedId), loadCustomers(query)]);
      setMessage("已建立工地與本月流水號");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function setCustomerStatus(customer: Customer, status: Customer["status"]) {
    setBusy(true);
    try {
      await api(`/api/apps/simpleshop/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadCustomers(query);
      setMessage(status === "ACTIVE" ? "客戶已恢復啟用" : "客戶已停用（歷史資料保留）");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void loadCustomers(query).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "搜尋失敗"));
          }}
        >
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋客戶名稱、電話或編號" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          <button className="rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">搜尋</button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {customers.length === 0 ? <p className="p-6 text-sm text-slate-400">尚未建立客戶，請從右側新增第一筆。</p> : null}
          {customers.map((customer) => (
            <button key={customer.id} type="button" onClick={() => setSelectedId(customer.id)} className={`flex w-full items-center justify-between gap-4 border-b border-slate-800 p-4 text-left last:border-0 ${selectedId === customer.id ? "bg-cyan-950/40" : "hover:bg-slate-800/70"}`}>
              <span>
                <span className="block font-semibold text-white">#{String(customer.customerCode).padStart(4, "0")} · {customer.name}</span>
                <span className="mt-1 block text-xs text-slate-400">{customer.phone || "未填電話"} · {customer._count?.jobSites ?? 0} 個工地</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${customer.status === "ACTIVE" ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{customer.status === "ACTIVE" ? "啟用" : "停用"}</span>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Selected customer</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{selected.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{selected.address || "未填地址"}</p>
              </div>
              <button disabled={busy} type="button" onClick={() => void setCustomerStatus(selected, selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500">
                {selected.status === "ACTIVE" ? "停用客戶" : "恢復客戶"}
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {jobSites.length === 0 ? <p className="text-sm text-slate-500">這位客戶尚無工地。</p> : null}
              {jobSites.map((site) => (
                <div key={site.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{site.name}</p>
                    <span className="text-xs text-cyan-300">本月 #{String(site.monthCodes?.[0]?.monthlyCode ?? "—").padStart(3, "0")}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{site.keyword || "無關鍵字"} · {site.contactPhone || "未填聯絡電話"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="space-y-5">
        <form onSubmit={createCustomer} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-white">新增客戶</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-xs text-slate-400">客戶名稱<input required value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">電話<input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">地址<input value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} className={inputClass} /></label>
          </div>
          <button disabled={busy} className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50">建立客戶</button>
        </form>

        <form onSubmit={createJobSite} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-white">新增工地</h2>
          <p className="mt-1 text-xs text-slate-500">{selected ? `歸屬：${selected.name}` : "請先選擇客戶"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="text-xs text-slate-400 sm:col-span-2 xl:col-span-1 2xl:col-span-2">工地名稱<input required disabled={!selected} value={siteForm.name} onChange={(event) => setSiteForm({ ...siteForm, name: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">關鍵字<input disabled={!selected} value={siteForm.keyword} onChange={(event) => setSiteForm({ ...siteForm, keyword: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400">聯絡人<input disabled={!selected} value={siteForm.contactName} onChange={(event) => setSiteForm({ ...siteForm, contactName: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400 sm:col-span-2 xl:col-span-1 2xl:col-span-2">電話<input disabled={!selected} value={siteForm.contactPhone} onChange={(event) => setSiteForm({ ...siteForm, contactPhone: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400 sm:col-span-2 xl:col-span-1 2xl:col-span-2">地址<input disabled={!selected} value={siteForm.address} onChange={(event) => setSiteForm({ ...siteForm, address: event.target.value })} className={inputClass} /></label>
            <label className="text-xs text-slate-400 sm:col-span-2 xl:col-span-1 2xl:col-span-2">別名（逗號分隔）<input disabled={!selected} value={siteForm.aliases} onChange={(event) => setSiteForm({ ...siteForm, aliases: event.target.value })} className={inputClass} /></label>
          </div>
          <button disabled={busy || !selected} className="mt-4 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">建立工地與月碼</button>
        </form>
        {message ? <p role="status" className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">{message}</p> : null}
      </aside>
    </div>
  );
}
