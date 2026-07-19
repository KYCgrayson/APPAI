"use client";

import { useState } from "react";
import { LookupPicker } from "./LookupPicker";
import type { LookupResult } from "@/lib/simpleshop/lookups";

export function ModuleLookupPreview() {
  const [customer, setCustomer] = useState<LookupResult | null>(null);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Shared lookup foundation</p>
        <h2 className="mt-2 text-lg font-semibold text-white">共用主檔查詢</h2>
        <p className="mt-1 text-sm text-slate-400">選取結果會回到目前表單，不會跳離或清除輸入內容。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LookupPicker kind="customer" onSelect={setCustomer} />
        <LookupPicker
          kind="job-site"
          customerId={customer?.kind === "customer" ? customer.id : undefined}
          disabled={customer?.kind !== "customer"}
          disabledReason="請先選擇客戶"
        />
        <LookupPicker kind="item" />
      </div>
    </section>
  );
}
