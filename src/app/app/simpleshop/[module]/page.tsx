import { notFound } from "next/navigation";
import { ModuleLookupPreview } from "@/components/apps/simpleshop/ModuleLookupPreview";
import { isSimpleshopModule, SIMPLESHOP_MODULES } from "@/lib/simpleshop/modules";

export default async function SimpleshopModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: key } = await params;
  if (!isSimpleshopModule(key)) notFound();
  const moduleDefinition = SIMPLESHOP_MODULES[key];

  return (
    <div>
      <div className="mb-8">
        <span className={`block h-2 w-16 rounded-full ${moduleDefinition.accent}`} />
        <h1 className="mt-5 text-3xl font-bold text-white">{moduleDefinition.title}</h1>
        <p className="mt-3 max-w-2xl text-slate-400">{moduleDefinition.description}</p>
      </div>
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="font-semibold text-white">管理功能建置中</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">目前已完成受保護路由、Organization context 與共用查詢介面。正式主檔與交易寫入會依 Simpleshop PRD 的 Phase 2–4 逐步加入。</p>
      </div>
      <ModuleLookupPreview />
    </div>
  );
}
