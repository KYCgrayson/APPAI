import { ItemManager } from "@/components/apps/simpleshop/ItemManager";

export default function SimpleshopItemsPage() {
  return (
    <div>
      <div className="mb-8">
        <span className="block h-2 w-16 rounded-full bg-emerald-500" />
        <p className="mt-5 text-sm font-semibold text-emerald-400">Phase 2 · Organization 主檔</p>
        <h1 className="mt-2 text-3xl font-bold text-white">品項與料號</h1>
        <p className="mt-3 max-w-2xl text-slate-400">管理正式料號、分類、材質、尺寸、別名與換算單位，供後續出貨與價格流程共用。</p>
      </div>
      <ItemManager />
    </div>
  );
}
