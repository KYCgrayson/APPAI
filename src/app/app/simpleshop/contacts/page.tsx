import { CustomerManager } from "@/components/apps/simpleshop/CustomerManager";

export default function SimpleshopContactsPage() {
  return (
    <div>
      <div className="mb-8">
        <span className="block h-2 w-16 rounded-full bg-amber-500" />
        <p className="mt-5 text-sm font-semibold text-amber-400">Phase 2 · Organization 主檔</p>
        <h1 className="mt-2 text-3xl font-bold text-white">客戶與工地</h1>
        <p className="mt-3 max-w-2xl text-slate-400">客戶編號永久遞增，工地月碼每月重新起算；停用只封存，不刪除歷史脈絡。</p>
      </div>
      <CustomerManager />
    </div>
  );
}
